param(
    [string]$ChineseFile = "docs/user-guide/changelog.md",
    [string]$EnglishFile = "docs/en/user-guide/changelog.md",
    [string]$OutputDir = "changelogs"
)

function Parse-Changelog {
    param(
        [string]$FilePath
    )
    
    $content = [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::UTF8)
    $versions = @{}
    
    # Split by version headers (## [version] - date)
    $pattern = '(?m)^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}'
    $matches = [regex]::Matches($content, $pattern)
    
    for ($i = 0; $i -lt $matches.Count; $i++) {
        $version = $matches[$i].Groups[1].Value
        $start = $matches[$i].Index
        $end = if ($i + 1 -lt $matches.Count) { $matches[$i + 1].Index } else { $content.Length }
        
        $versionContent = $content.Substring($start, $end - $start).Trim()
        $versions[$version] = $versionContent
    }
    
    return $versions
}

Write-Host "Parsing Chinese changelog..."
$chineseVersions = Parse-Changelog -FilePath $ChineseFile

Write-Host "Parsing English changelog..."
$englishVersions = Parse-Changelog -FilePath $EnglishFile

# Get all unique versions
$allVersions = @()
$allVersions += $chineseVersions.Keys
$allVersions += $englishVersions.Keys
$allVersions = $allVersions | Sort-Object -Unique

Write-Host "Found $($allVersions.Count) versions"

foreach ($version in $allVersions) {
    $versionDir = Join-Path $OutputDir "v$version"
    
    # Create version directory
    if (-not (Test-Path $versionDir)) {
        New-Item -ItemType Directory -Path $versionDir -Force | Out-Null
    }
    
    # Create English file
    if ($englishVersions.ContainsKey($version)) {
        $enFile = Join-Path $versionDir "v$version.md"
        $enHeader = [System.Text.Encoding]::UTF8.GetBytes("# Changelog`n`n")
        $enContent = [System.Text.Encoding]::UTF8.GetBytes($englishVersions[$version])
        $enBytes = New-Object byte[] ($enHeader.Length + $enContent.Length)
        [System.Buffer]::BlockCopy($enHeader, 0, $enBytes, 0, $enHeader.Length)
        [System.Buffer]::BlockCopy($enContent, 0, $enBytes, $enHeader.Length, $enContent.Length)
        [System.IO.File]::WriteAllBytes($enFile, $enBytes)
        Write-Host "Created: $enFile"
    }
    
    # Create Chinese file
    if ($chineseVersions.ContainsKey($version)) {
        $zhFile = Join-Path $versionDir "v$version.zh-CN.md"
        $zhHeader = [System.Text.Encoding]::UTF8.GetBytes("# 更新日志`n`n")
        $zhContent = [System.Text.Encoding]::UTF8.GetBytes($chineseVersions[$version])
        $zhBytes = New-Object byte[] ($zhHeader.Length + $zhContent.Length)
        [System.Buffer]::BlockCopy($zhHeader, 0, $zhBytes, 0, $zhHeader.Length)
        [System.Buffer]::BlockCopy($zhContent, 0, $zhBytes, $zhHeader.Length, $zhContent.Length)
        [System.IO.File]::WriteAllBytes($zhFile, $zhBytes)
        Write-Host "Created: $zhFile"
    }
}

Write-Host "`nDone! Created changelog files in $OutputDir"
