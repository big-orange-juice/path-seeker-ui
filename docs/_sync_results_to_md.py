# -*- coding: utf-8 -*-
"""将 functional-test-results.json 同步回 functional-test-checklist.md 勾选与缺陷表。"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MD_PATH = ROOT / "functional-test-checklist.md"
RESULTS_PATH = ROOT / "functional-test-results.json"

MARK = {
    "通过": "✅",
    "失败": "❌",
    "阻塞": "🚫",
    "跳过": "⏭",
    "未测": "☐",
}

data = json.loads(RESULTS_PATH.read_text(encoding="utf-8"))
meta = data.get("meta") or {}
cases = data.get("cases") or {}
smoke = data.get("smoke") or {}
defects = data.get("defects") or []

text = MD_PATH.read_text(encoding="utf-8")
lines = text.splitlines()

# --- 前置信息 ---
pre_map = {
    "日期": meta.get("date", ""),
    "测试人": meta.get("tester", ""),
    "前端 commit / 分支": meta.get("branch", ""),
    "后端环境（联调 / 预发 / 生产）": meta.get("backend", ""),
    "H5 访问地址": meta.get("h5", ""),
    "后台访问地址": meta.get("admin", ""),
    "测试账号（游客 / 正式）": meta.get("accounts", ""),
    "后台管理员账号": "admin / admin123456",
    "后台导游账号": "douzong / admin123456（CREATOR，需审）",
    "测试路线 ID 列表": meta.get("routes", ""),
}


def fill_preflight_row(line: str) -> str:
    m = re.match(r"^\|\s*([^|]+?)\s*\|\s*([^|]*)\s*\|\s*$", line)
    if not m:
        return line
    key = m.group(1).strip()
    if key in ("项", "---") or key.startswith("---"):
        return line
    if key in pre_map and pre_map[key]:
        return f"| {key} | {pre_map[key]} |"
    return line


# --- 缺陷表 ---
def build_defect_table() -> list[str]:
    rows = [
        "### 缺陷记录（本轮）",
        "",
        "| ID | 模块 | 步骤 | 期望 | 实际 | 严重度 | 截图/录屏 | 状态 |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for d in defects:
        rows.append(
            "| {id} | {module} | {steps} | {expected} | {actual} | {severity} | {shot} | {status} |".format(
                id=d.get("id", ""),
                module=d.get("module", ""),
                steps=(d.get("steps") or "").replace("|", "/"),
                expected=(d.get("expected") or "").replace("|", "/"),
                actual=(d.get("actual") or "").replace("|", "/"),
                severity=d.get("severity", ""),
                shot=d.get("screenshot") or "—",
                status=d.get("status", "待修"),
            )
        )
    rows.append("")
    rows.append(f"> 关联用例见 `docs/functional-test-results.json`；共 {len(defects)} 条。")
    rows.append("")
    return rows


# --- 用例行结果 ---
def patch_case_line(line: str) -> str:
    if not line.strip().startswith("|"):
        return line
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if not cells:
        return line
    cid = cells[0]
    if cid in cases:
        result = cases[cid].get("result") or "未测"
        mark = MARK.get(result, "☐")
        cells[-1] = mark
        return "| " + " | ".join(cells) + " |"
    if cid in smoke:
        result = smoke[cid].get("result") or "未测"
        mark = MARK.get(result, "☐")
        cells[-1] = mark
        return "| " + " | ".join(cells) + " |"
    return line


# --- 结论 ---
def build_conclusion() -> list[str]:
    return [
        "## 10. 本次测试结论（汇总页）",
        "",
        "| 项 | 内容 |",
        "| --- | --- |",
        f"| 总体结论 | **{meta.get('conclusion', '有条件通过')}** |",
        f"| P0 缺陷数 | {meta.get('p0', 0)} |",
        f"| P1 缺陷数 | {meta.get('p1', 0)} |",
        f"| P2 缺陷数 | {meta.get('p2', 0)} |",
        f"| 阻塞项 | {meta.get('blockers', '')} |",
        f"| 遗留风险 | {meta.get('risks', '')} |",
        f"| 签字 / 日期 | {meta.get('tester', '')} / {meta.get('date', '')} |",
        "",
        "结果数据源：`docs/functional-test-results.json`（改结果后执行 `py -3 docs/_sync_results_to_md.py` 与 `py -3 docs/_gen_test_cases_xlsx.py`）。",
        "",
    ]


out: list[str] = []
i = 0
n = len(lines)
in_preflight = False
defect_template_done = False
skip_until_severity = False
skip_conclusion = False

while i < n:
    line = lines[i]

    # 前置表
    if line.startswith("## 0."):
        in_preflight = True
        out.append(line)
        i += 1
        continue

    if in_preflight and line.startswith("### 建议准备"):
        in_preflight = False

    if in_preflight and line.startswith("|"):
        out.append(fill_preflight_row(line))
        i += 1
        continue

    # 缺陷模板后：只保留空表头，丢弃历史「本轮」表，再注入最新缺陷
    if (
        not defect_template_done
        and line.startswith("### 缺陷记录模板")
    ):
        out.append(line)
        i += 1
        # 只保留模板表头两行，跳过旧的「缺陷记录（本轮）」整段直到严重度说明
        while i < n and not lines[i].startswith("**严重度建议**"):
            if lines[i].startswith("| ID |") or lines[i].startswith("| ---"):
                # 模板表头：只写一次
                if not any(x.startswith("| ID |") for x in out[-5:]):
                    out.append(lines[i])
            elif lines[i].startswith("### 缺陷记录"):
                # 跳过旧本轮缺陷块（含表与说明）
                i += 1
                while i < n and not (
                    lines[i].startswith("### ")
                    or lines[i].startswith("**严重度建议**")
                    or lines[i].startswith("## ")
                ):
                    i += 1
                continue
            elif lines[i].startswith("|"):
                pass  # 丢弃模板空数据行与旧缺陷数据行
            elif lines[i].strip() == "":
                pass
            elif lines[i].startswith(">"):
                pass  # 丢弃旧关联说明
            else:
                out.append(lines[i])
            i += 1
        out.append("")
        out.extend(build_defect_table())
        defect_template_done = True
        continue

    # 结论整段替换
    if line.startswith("## 10."):
        out.extend(build_conclusion())
        i += 1
        while i < n and not lines[i].startswith("## 附"):
            i += 1
        continue

    # 用例/Smoke 结果列
    if line.startswith("|") and re.match(r"^\|\s*[\dS]", line):
        out.append(patch_case_line(line))
        i += 1
        continue

    out.append(line)
    i += 1

MD_PATH.write_text("\n".join(out) + "\n", encoding="utf-8")
print(f"updated: {MD_PATH}")
print(f"cases marked: {len(cases)}, smoke: {len(smoke)}, defects: {len(defects)}")
