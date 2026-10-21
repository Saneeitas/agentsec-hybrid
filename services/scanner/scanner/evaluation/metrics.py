from collections.abc import Iterable


def _ratio(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 6) if denominator else None


def calculate_metrics(rows: Iterable[dict[str, object]]) -> dict[str, object]:
    included = [row for row in rows if row["classification"] in {"TP", "FP", "TN", "FN"}]
    counts = {name: sum(row["classification"] == name for row in included) for name in ("TP", "FP", "TN", "FN")}
    tp, fp, tn, fn = (counts[name] for name in ("TP", "FP", "TN", "FN"))
    evidence_tp = sum(row["classification"] == "TP" and bool(row.get("evidence_references")) for row in included)
    return {
        "truePositives": tp,
        "falsePositives": fp,
        "trueNegatives": tn,
        "falseNegatives": fn,
        "precision": _ratio(tp, tp + fp),
        "recall": _ratio(tp, tp + fn),
        "falsePositiveRate": _ratio(fp, fp + tn),
        "f1Score": _ratio(2 * tp, 2 * tp + fp + fn),
        "evidenceCoverage": _ratio(evidence_tp, tp),
        "eligibleUnits": len(included),
        "ineligibleUnits": sum(row["classification"] == "INELIGIBLE" for row in rows),
        "inconclusiveUnits": sum(row["classification"] == "INCONCLUSIVE" for row in rows),
    }
