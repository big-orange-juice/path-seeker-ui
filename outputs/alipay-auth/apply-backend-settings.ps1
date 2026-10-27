$ErrorActionPreference = 'Stop'
$settingsPath = 'D:/workspace/amh/code/CulturalTourism/git_src/CulturalTourism_System/CulturalTourismSystem.WebApi/appsettings.json'
$keyFilePath = Join-Path $PSScriptRoot '.env.local'
$settingsText = [System.IO.File]::ReadAllText($settingsPath)
$settingsBefore = $settingsText | ConvertFrom-Json
if ($null -ne $settingsBefore.MiniProgramAuth) {
    throw 'MiniProgramAuth already exists; review the existing configuration before applying.'
}
$environmentValues = @{}
foreach ($entry in [System.IO.File]::ReadAllLines($keyFilePath)) {
    if ([string]::IsNullOrWhiteSpace($entry)) { continue }
    $separator = $entry.IndexOf('=')
    if ($separator -le 0) { throw 'Invalid environment configuration entry.' }
    $entryName = $entry.Substring(0, $separator)
    $entryValue = $entry.Substring($separator + 1).Trim([char]39)
    $environmentValues[$entryName] = $entryValue.Replace('\n', "`n")
}
$alipaySettings = [ordered]@{}
foreach ($settingName in @('AppId', 'IdentityField', 'PrivateKeyPem', 'AlipayPublicKeyPem')) {
    $settingValue = $environmentValues['MiniProgramAuth__Alipay__' + $settingName]
    if ([string]::IsNullOrWhiteSpace($settingValue)) { throw "Missing setting: $settingName" }
    $alipaySettings[$settingName] = $settingValue
}
if ($alipaySettings.AppId -ne '2021007110628321') { throw 'Unexpected application ID.' }
$configurationBlock = [ordered]@{ MiniProgramAuth = [ordered]@{ Alipay = $alipaySettings } } | ConvertTo-Json -Depth 5
$blockLines = $configurationBlock -split '\r?\n'
$additionLines = @($blockLines[1..($blockLines.Count - 2)])
$additionLines[$additionLines.Count - 1] += ','
$patchLines = @('*** Begin Patch', ('*** Update File: ' + $settingsPath), '@@', ' {')
$patchLines += @($additionLines | ForEach-Object { '+' + $_ })
$patchLines += '*** End Patch'
$patchText = ($patchLines -join "`n") + "`n"
& 'C:/Users/zhmou/AppData/Local/OpenAI/Codex/bin/2993767bd1dfb009/codex.exe' --codex-run-as-apply-patch $patchText
if ($LASTEXITCODE -ne 0) { throw 'Failed to apply backend configuration patch.' }
$settingsAfter = [System.IO.File]::ReadAllText($settingsPath) | ConvertFrom-Json
foreach ($settingName in $alipaySettings.Keys) {
    if ($settingsAfter.MiniProgramAuth.Alipay.$settingName -cne $alipaySettings[$settingName]) {
        throw "Configuration verification failed: $settingName"
    }
}
foreach ($existingProperty in $settingsBefore.PSObject.Properties) {
    $beforeValue = ConvertTo-Json -InputObject $existingProperty.Value -Depth 100 -Compress
    $afterValue = ConvertTo-Json -InputObject $settingsAfter.($existingProperty.Name) -Depth 100 -Compress
    if ($beforeValue -cne $afterValue) { throw "Existing configuration changed: $($existingProperty.Name)" }
}
Write-Output 'Backend JSON validated; all four Alipay settings match and existing configuration is preserved.'
