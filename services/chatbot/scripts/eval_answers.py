"""
Answer-quality eval: runs a fixed set of questions against a running chatbot and
writes a markdown report to review with the client (before/after a prompt change).

Usage:
    python scripts/eval_answers.py --url http://localhost:8001 --user-id <ObjectId> \
        --api-key "$API_KEY" --out eval-after.md

Use a real test user with a postpartum profile and a baby added, so personalisation
can be judged. Each conversation runs in its own session; multi-turn cases ("yes",
"No, …") share one.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
import uuid

# (label, [turns]) — every turn in a case shares one session.
CASES = [
    ("Expert request (generic)", ["I want to speak with an expert"]),
    ("Expert request after decline", ["my baby is not latching well",
                                      "No I want to speak to an expert. Can you help me connect with a lactation expert"]),
    ("Expert request (lactation)", ["How can I connect with a viva mama lactation expert"]),
    ("Directory question (gynae)", ["Which gynaecologist do you have in this app"]),
    ("Identity loss + follow-up", ["Since becoming a mother I don't recognize myself anymore and feel like I've lost my old identity — why is this happening?", "yes"]),
    ("Low milk supply", ["I feel my milk supply is low, what can I do?"]),
    ("C-section wound", ["How do I take care of my c-section stitches?"]),
    ("Baby sleep", ["How much should my baby be sleeping right now?"]),
    ("Diet with GDM history", ["What should I eat now that I had gestational diabetes in pregnancy?"]),
    ("Anxiety", ["I feel anxious all the time since the delivery"]),
    ("Hinglish", ["Delivery ke baad baal bahut gir rahe hain, kya karun?"]),
    ("Hindi", ["प्रसव के बाद कमर दर्द के लिए क्या करूँ?"]),
    ("Emergency", ["I am bleeding heavily and soaking a pad every hour"]),
]

TITLED = re.compile(r"\b(?:Dr|Ms|Mrs|Mr)\.?\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?")


def ask(url: str, api_key: str, user_id: str, session_id: str, text: str) -> dict:
    body = json.dumps({"query": text, "user_id": user_id, "session_id": session_id}).encode()
    req = urllib.request.Request(
        url.rstrip("/") + "/v1/chat",
        data=body,
        headers={"Content-Type": "application/json", "X-API-Key": api_key},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def metrics(answer: str) -> dict:
    lines = answer.splitlines()
    return {
        "words": len(answer.split()),
        "bullets": sum(1 for ln in lines if ln.lstrip().startswith(("*", "-", "•"))),
        "offer": any("know more" in ln.lower() for ln in lines[-2:]),
        "names": sorted(set(TITLED.findall(answer))),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8001")
    ap.add_argument("--user-id", required=True)
    ap.add_argument("--api-key", default="")
    ap.add_argument("--out", default="eval-report.md")
    args = ap.parse_args()

    out = ["# Chatbot answer eval", "", f"User: `{args.user_id}`", ""]
    summary = []
    for label, turns in CASES:
        session = str(uuid.uuid4())
        out += [f"## {label}", ""]
        for text in turns:
            try:
                r = ask(args.url, args.api_key, args.user_id, session, text)
            except Exception as e:  # keep going; the report shows the failure
                out += [f"**Q:** {text}", "", f"> ERROR: {e}", ""]
                continue
            answer = r.get("answer", "")
            m = metrics(answer)
            experts = [e.get("name") for e in r.get("suggested_experts") or []]
            out += [
                f"**Q:** {text}",
                "",
                f"`intent={r.get('intent')}  words={m['words']}  bullets={m['bullets']}  "
                f"offer={m['offer']}  button={experts or '-'}  rag_score={r.get('rag_best_score')}`",
                "",
                *[f"> {ln}" if ln else ">" for ln in answer.splitlines()],
                "",
            ]
            if m["names"]:
                out += [f"Named people: {', '.join(m['names'])}", ""]
            summary.append((label, text[:40], r.get("intent"), m["words"], m["bullets"], experts))

    out += ["## Summary", "", "| Case | Question | Intent | Words | Bullets | Button |", "|---|---|---|---|---|---|"]
    out += [f"| {a} | {b} | {c} | {d} | {e} | {', '.join(f) or '-'} |" for a, b, c, d, e, f in summary]
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out) + "\n")
    print(f"Wrote {args.out} ({len(summary)} answers)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
