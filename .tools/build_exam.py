"""Собирает банк вопросов экзамена «1С:Профессионал» из PDF-сборника.

    pip install pymupdf
    python .tools/build_exam.py "C:/Users/Marat/Desktop/Сборник вопросов 1С-Профессионал 2021.pdf"

Правильные ответы в PDF отмечены жёлтыми аннотациями Highlight, формулировки
вопросов — зелёными. Результат: site/public/exam/bank.json (картинки внутри
как data URI). Файл хранится в Git и публикуется вместе с сайтом.
"""
import base64, collections, json, os, re, sys, time
sys.stdout.reconfigure(encoding="utf-8")
import pymupdf

QUESTION_PAGES = range(7, 239)   # страницы 8–239: раздел 1
SAMPLE_PAGES = range(239, 245)   # 240–245: примеры заданий
ANSWER_PAGES = range(245, 249)   # 246–249: ответы с комментариями
FIRST_PAGE = 8                   # номер в книге первой страницы раздела 1
OUT = os.path.join(os.path.dirname(__file__), "..", "site", "public", "exam", "bank.json")

# Разметка двух вопросов в сборнике противоречива (выделено несколько вариантов).
# Выбран вариант, верный для актуальной платформы; вопрос помечается как спорный.
DISPUTED = {"10.57": 2, "10.108": 5}


OFFSET = 0  # сдвиг номеров страниц файла относительно книги


def page_lines(page):
    """Строки страницы: текст, рамка, выделение жёлтым (ответ) и зелёным (вопрос)."""
    yellow, green = [], []
    for a in page.annots() or []:
        if a.type[0] != 8:
            continue
        (yellow if a.colors["stroke"][0] > 0.9 else green).append(a.rect)
    rows = collections.OrderedDict()
    items = []
    for b in page.get_text("dict")["blocks"]:
        if b["type"] == 1:
            items.append({"kind": "img", "bbox": b["bbox"]})
            continue
        for l in b["lines"]:
            for s in l["spans"]:
                if not s["text"].strip():
                    continue
                yc = round((s["bbox"][1] + s["bbox"][3]) / 2)
                key = next((k for k in rows if abs(k - yc) <= 2), yc)
                rows.setdefault(key, []).append((s["bbox"], s["text"]))
    for yc, spans in rows.items():
        spans.sort(key=lambda p: p[0][0])
        x0 = min(b[0] for b, _ in spans); y0 = min(b[1] for b, _ in spans)
        x1 = max(b[2] for b, _ in spans); y1 = max(b[3] for b, _ in spans)
        hit = lambda rs: any(r.y0 < yc < r.y1 and r.x1 > x0 and r.x0 < x1 for r in rs)
        text = " ".join(" ".join(t for _, t in spans).split())
        items.append({"kind": "text", "bbox": [x0, y0, x1, y1], "text": text, "y": hit(yellow), "g": hit(green)})
    items.sort(key=lambda it: it["bbox"][1])
    for it in items:
        it["page"] = page.number + 1
        it["book"] = page.number + 1 + OFFSET
    # колонтитулы
    return [it for it in items if it["kind"] == "img" or 60 <= it["bbox"][1] <= 780]


def make_joiner(lines):
    corpus = collections.Counter(w.lower() for it in lines if it["kind"] == "text" for w in re.findall(r"[\w-]+", it["text"]))

    def join(a, b):
        if not a:
            return b
        m = re.search(r"(\w+)-$", a)
        if m and b[:1].isalpha():
            w2 = re.match(r"\w+", b).group(0)
            if corpus[f"{m.group(1)}-{w2}".lower()] and not corpus[f"{m.group(1)}{w2}".lower()]:
                return a + b
            return a[:-1] + b
        return a + " " + b
    return join


def clean_option(text):
    return re.sub(r"^\d+\.\s+", "", text).strip()  # «1. 1. клиентским» → «клиентским»


def parse_questions(doc):
    lines = [it for pn in QUESTION_PAGES for it in page_lines(doc[pn])]
    join = make_joiner(lines)
    q_re = re.compile(r"^(\d{1,2})\.(\d{1,3})\s*(.*)$")
    o_re = re.compile(r"^(\d{1,2})[.)]\s*(.*)$")
    t_re = re.compile(r"^(\d{1,2})\. (\D.*)$")
    topics, qs = {}, []
    cur, topic, state = None, 0, None
    for it in lines:
        if it["kind"] == "img":
            if cur is not None:
                cur["_images"].append((it["page"], it["bbox"]))
            continue
        t = it["text"]
        m = q_re.match(t)
        if m and topic and int(m.group(1)) == topic and (cur is None or int(m.group(2)) == cur["n"] + 1 or it["g"]):
            cur = {"id": f"{topic}.{int(m.group(2))}", "topic": topic, "n": int(m.group(2)), "text": m.group(3),
                   "options": [], "_correct": [], "_images": []}
            qs.append(cur); state = "q"
            continue
        mt = t_re.match(t)
        indent = 60 if it["book"] % 2 == 0 else 74  # заголовки тем стоят на уровне номеров вопросов
        if not it["g"] and mt and abs(it["bbox"][0] - indent) < 6 and int(mt.group(1)) == topic + 1:
            topic = int(mt.group(1)); topics[topic] = mt.group(2).strip(); cur = None; state = None
            continue
        if cur is None:
            continue
        mo = o_re.match(t)
        if mo and not it["g"] and int(mo.group(1)) == len(cur["options"]) + 1:
            cur["options"].append(mo.group(2)); cur["_correct"].append(it["y"]); state = "o"
        elif state == "q" or it["g"]:
            cur["text"] = join(cur["text"], t)
        elif state == "o":
            cur["options"][-1] = join(cur["options"][-1], t)
            cur["_correct"][-1] = cur["_correct"][-1] or it["y"]
    return topics, qs


def render_images(doc, q):
    out = []
    for pn, bbox in q.pop("_images"):
        pix = doc[pn - 1].get_pixmap(matrix=pymupdf.Matrix(1.75, 1.75), clip=pymupdf.Rect(bbox), annots=False)
        out.append("data:image/jpeg;base64," + base64.b64encode(pix.tobytes("jpeg", jpg_quality=82)).decode())
    return out


def norm(text):
    return re.sub(r"[^\wа-яё]+", " ", text.lower().replace("ё", "е")).strip()


def parse_samples(doc):
    """Примеры экзаменационных заданий: вопросы и комментарии к ответам."""
    text = "\n".join(doc[pn].get_text() for pn in SAMPLE_PAGES)
    tasks = re.split(r"\nЗадание \d\s*\n", text)[1:]
    sample_q = []
    for task in tasks:
        sample_q.append([re.sub(r"\s+", " ", m).strip() for m in re.findall(r"№\d+\.\s*(.*?)\n\s*1\.", task, re.S)])
    text = "\n".join(doc[pn].get_text() for pn in ANSWER_PAGES)
    tasks = re.split(r"\nЗадание \d\s*\n", text)[1:]
    comments = []
    for task in tasks:
        task = re.sub(r"Сертификация \"1С:Профессионал\".*?\n.*?\n", "", task)
        task = re.sub(r"Номер\s*\n\s*вопроса\s*\n\s*Номер\s*\n\s*правильного\s*\n\s*ответа\s*\n\s*Комментарий\s*\n", "", task)
        rows, cur = [], None
        lines = [l.strip() for l in task.split("\n") if l.strip()]
        i = 0
        while i < len(lines):
            if re.fullmatch(r"\d{1,2}", lines[i]) and i + 1 < len(lines) and re.fullmatch(r"\d", lines[i + 1]) and int(lines[i]) == len(rows) + 1:
                cur = {"answer": int(lines[i + 1]), "text": ""}; rows.append(cur); i += 2; continue
            if cur is not None:
                line = lines[i]
                cur["text"] = cur["text"][:-1] + line if cur["text"].endswith("-") else (cur["text"] + " " + line).strip()
            i += 1
        comments.append(rows)
    result = []
    for qs, cs in zip(sample_q, comments):
        for q, c in zip(qs, cs):
            result.append({"question": q, "answer": c["answer"], "comment": c["text"]})
    return result


def words(text):
    return {w[:6] for w in norm(text).split() if len(w) > 2}


def main(pdf):
    global QUESTION_PAGES, OFFSET
    doc = pymupdf.open(pdf)
    # Выписка только раздела 1 (232 страницы): без примеров заданий и разборов.
    full = doc.page_count >= ANSWER_PAGES.stop
    if not full:
        OFFSET = FIRST_PAGE - 1
        QUESTION_PAGES = range(0, min(doc.page_count, QUESTION_PAGES.stop - OFFSET))
    topics, qs = parse_questions(doc)
    problems = []
    for q in qs:
        q["text"] = q["text"].strip()
        q["options"] = [clean_option(o) for o in q["options"]]
        correct = [i for i, c in enumerate(q.pop("_correct")) if c]
        if q["id"] in DISPUTED:
            q["answer"] = DISPUTED[q["id"]] - 1
            q["disputed"] = f"В сборнике выделено несколько вариантов: {', '.join(str(i + 1) for i in correct)}"
        elif len(correct) == 1:
            q["answer"] = correct[0]
        else:
            problems.append(q["id"]); q["answer"] = correct[0] if correct else 0
        if len(q["options"]) < 2:
            problems.append(q["id"])
        q["images"] = render_images(doc, q)

    sig = {q["id"]: words(q["text"]) for q in qs}
    jaccard = lambda a, b: len(a & b) / len(a | b) if a and b else 0
    for s in parse_samples(doc) if full else []:
        w = words(s["question"])
        q = max(qs, key=lambda q: jaccard(w, sig[q["id"]]))
        if jaccard(w, sig[q["id"]]) < 0.7:
            print("! пример без пары в банке:", s["question"][:60]); continue
        q["comment"] = s["comment"]
        if s["answer"] - 1 != q["answer"]:
            print(f"! {q['id']}: в разборе верным назван вариант {s['answer']}, выделен {q['answer'] + 1}")
            q.setdefault("disputed", f"В разборе примерного задания верным назван вариант {s['answer']}, а в сборнике выделен {q['answer'] + 1}")

    # Похожие формулировки с разными ответами — их легко перепутать.
    for q in qs:
        sim = []
        for o in qs:
            if o is q or o["topic"] != q["topic"]:
                continue
            if jaccard(sig[q["id"]], sig[o["id"]]) >= 0.6:
                sim.append(o["id"])
        if sim:
            q["similar"] = sim[:6]

    for q in qs:
        del q["n"]
    bank = {
        "app": "re-1c-exam", "version": 1,
        "title": "1С:Профессионал — основные механизмы платформы «1С:Предприятие 8»",
        "source": "Комплект вопросов сертификационного экзамена, издание 2, версия июль 2021",
        "builtAt": int(time.time() * 1000),
        "topics": [{"id": k, "title": v} for k, v in sorted(topics.items())],
        "questions": qs,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(bank, f, ensure_ascii=False, separators=(",", ":"))
    print(f"тем: {len(topics)}, вопросов: {len(qs)}, с картинками: {sum(1 for q in qs if q['images'])}, "
          f"с разбором: {sum(1 for q in qs if 'comment' in q)}, спорных: {sum(1 for q in qs if 'disputed' in q)}, "
          f"с похожими: {sum(1 for q in qs if 'similar' in q)}")
    print(f"размер: {os.path.getsize(OUT) / 1e6:.1f} МБ → {os.path.normpath(OUT)}")
    if problems:
        print("! проверьте вручную:", ", ".join(problems))


if __name__ == "__main__":
    main(sys.argv[1])
