"""为 tourMessages.ts 的其余语种补齐 permissionDenied 文案。

只在各语种已有的 locationFailed 文案后面追加一条新文案，不动其它内容；
每个 anchor 只应命中一次，命中数不为 1 时直接报错，避免误改。
"""

from pathlib import Path

target = Path(r"D:\workspace\amh\code\CulturalTourism\web\path-seeker-ui\apps\h5-client\src\utils\tourMessages.ts")
text = target.read_text(encoding="utf-8")

insertions = [
    (
        "locationFailed: 'Location unavailable. Select a stop manually.',",
        " locationFailed: 'Location unavailable. Select a stop manually.', permissionDenied: 'Location permission is denied. Allow it in your browser settings and retry.',",
    ),
    (
        "locationFailed: 'Геолокация недоступна. Выберите остановку вручную.',",
        " locationFailed: 'Геолокация недоступна. Выберите остановку вручную.', permissionDenied: 'Доступ к геолокации запрещён. Разрешите его в настройках браузера и повторите.',",
    ),
    (
        "locationFailed: 'Ubicación no disponible. Selecciona una parada.',",
        " locationFailed: 'Ubicación no disponible. Selecciona una parada.', permissionDenied: 'Permiso de ubicación denegado. Actívalo en los ajustes del navegador y reintenta.',",
    ),
    (
        "locationFailed: 'Localisation indisponible. Sélectionnez une étape manuellement.',",
        " locationFailed: 'Localisation indisponible. Sélectionnez une étape manuellement.', permissionDenied: 'Autorisation de localisation refusée. Autorisez-la dans les réglages du navigateur, puis réessayez.',",
    ),
    (
        "locationFailed: '位置情報を取得できません。スポットを手動で選択してください。',",
        " locationFailed: '位置情報を取得できません。スポットを手動で選択してください。', permissionDenied: '位置情報の利用が許可されていません。ブラウザの設定で許可してから再試行してください。',",
    ),
]

for anchor, replacement in insertions:
    count = text.count(anchor)
    if count != 1:
        raise SystemExit(f"anchor matched {count} times: {anchor[:48]}")
    text = text.replace(anchor, replacement)

target.write_text(text, encoding="utf-8")
print("permissionDenied inserted for en/ru/es/fr/ja")
