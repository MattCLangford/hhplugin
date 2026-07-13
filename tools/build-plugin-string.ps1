param(
  [string]$ManifestPath = "",
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $ManifestPath) {
  $ManifestPath = Join-Path $repoRoot "manifest.json"
}

if (-not (Test-Path -LiteralPath $ManifestPath)) {
  throw "Manifest not found: $ManifestPath"
}

$manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
$baseUrl = [string]$manifest.deployment.baseUrl
if (-not $baseUrl) {
  throw "manifest.json is missing deployment.baseUrl"
}
if (-not $baseUrl.EndsWith("/")) {
  $baseUrl += "/"
}

if (-not $OutputPath) {
  $configuredOutput = [string]$manifest.deployment.pluginStringDoc
  if (-not $configuredOutput) {
    $configuredOutput = "docs/HIREHOP_PLUGIN_STRING.md"
  }
  $OutputPath = Join-Path $repoRoot $configuredOutput
}

$scripts = @($manifest.activeScripts | Sort-Object recommendedLoadOrder)
if (-not $scripts.Count) {
  throw "manifest.json has no activeScripts entries"
}
$lazyScripts = @($manifest.lazyScripts | Sort-Object recommendedLoadOrder)

$urls = New-Object System.Collections.Generic.List[string]
$tableRows = New-Object System.Collections.Generic.List[string]
$lazyTableRows = New-Object System.Collections.Generic.List[string]

foreach ($script in $scripts) {
  $file = [string]$script.file
  $version = [string]$script.cacheVersion
  $order = [string]$script.recommendedLoadOrder

  if (-not $file) {
    throw "An activeScripts entry is missing file"
  }
  if (-not $version) {
    throw "$file is missing cacheVersion"
  }
  if (-not $order) {
    throw "$file is missing recommendedLoadOrder"
  }

  $localFile = Join-Path $repoRoot $file
  if (-not (Test-Path -LiteralPath $localFile)) {
    throw "Runtime file listed in manifest does not exist locally: $file"
  }

  $urls.Add("$baseUrl$($file)?v=$version") | Out-Null
  $tableRows.Add(('| {0} | `{1}` | `{2}` |' -f $order, $file, $version)) | Out-Null
}

foreach ($script in $lazyScripts) {
  $file = [string]$script.file
  $version = [string]$script.cacheVersion
  $order = [string]$script.recommendedLoadOrder
  $status = [string]$script.status
  $enabled = if ($null -ne $script.enabled -and -not [bool]$script.enabled) { "no" } else { "yes" }

  if (-not $file) {
    throw "A lazyScripts entry is missing file"
  }
  if (-not $version) {
    throw "$file is missing cacheVersion"
  }
  if (-not $order) {
    throw "$file is missing recommendedLoadOrder"
  }

  $localFile = Join-Path $repoRoot $file
  if (-not (Test-Path -LiteralPath $localFile)) {
    throw "Runtime file listed in manifest does not exist locally: $file"
  }

  $lazyTableRows.Add(('| {0} | `{1}` | `{2}` | `{3}` | {4} |' -f $order, $file, $version, $status, $enabled)) | Out-Null
}

$pluginString = ($urls -join "; ") + ";"
$table = $tableRows -join [Environment]::NewLine
$lazyTable = $lazyTableRows -join [Environment]::NewLine
$fence = '```'
$lazySection = ""
if ($lazyTableRows.Count) {
  $lazySection = @"

## Lazy Loaded Runtime Modules

These files are not included directly in the HireHop company config string. ``0-loader.js`` injects them only when the matching HireHop page, tab set, supplying list, or dialog exists.

| Order | File | Cache version | Trigger | Enabled |
| --- | --- | --- | --- | --- |
$lazyTable
"@
}

$content = @"
# HireHop Plugin String

This file is generated from ``manifest.json`` by ``tools/build-plugin-string.ps1``.

Do not hand-edit the current string or source table. Update ``manifest.json`` first, then regenerate this file.

## Current String

${fence}text
$pluginString
${fence}

## Source Table

| Order | File | Cache version |
| --- | --- | --- |
$table
$lazySection

## Maintenance Rule

When Codex updates an active or lazy runtime ``.js`` file, increment that file's ``cacheVersion`` by ``0.1`` in ``manifest.json`` and mirror that version in ``0-loader.js`` if the file is lazy-loaded, then run:

${fence}powershell
.\tools\build-plugin-string.ps1
${fence}

When a change touches multiple runtime ``.js`` files, increment each touched file by ``0.1``.

When Codex adds a new runtime ``.js`` file, add it to:

- ``manifest.json``
- ``docs/LOAD_ORDER.md``
- ``docs/HIREHOP_PLUGIN_STRING.md`` by running this generator
- ``0-loader.js`` if it should be lazy-loaded

New runtime files start at ``?v=0.1`` unless they are replacing an existing file, in which case use the next version for that replaced file.

## Quick Test

After updating HireHop company config, run this in the browser console:

${fence}js
window.WiseHireHopEnhancementLoader
${fence}

On a supplying-list page, the proposal bundle should lazy-load. Inspect the result with:

${fence}js
window.WiseHireHopEnhancementLoader.loaded
${fence}

Enabled supplying-list modules such as ``hirehop``, ``docprev``, and ``stage`` should be ``true``. A disabled module such as ``editor`` should be absent.
"@

$outputDir = Split-Path -Parent $OutputPath
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

[System.IO.File]::WriteAllText($OutputPath, $content, [System.Text.UTF8Encoding]::new($false))
Write-Output "Wrote $OutputPath"
Write-Output $pluginString
