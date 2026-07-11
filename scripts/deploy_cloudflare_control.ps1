param(
    [string]$Config = "cloudflare\worker\wrangler.toml",
    [string]$TokenName = "ACTIVITY_API_TOKEN"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Wrangler {
    param([string[]]$Arguments)
    & npx wrangler @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "wrangler failed: $($Arguments -join ' ')"
    }
}

Write-Host "Checking Cloudflare authentication..."
& npx wrangler whoami
if ($LASTEXITCODE -ne 0) {
    throw "Wrangler is not logged in. Run: npx wrangler login"
}

$toml = Get-Content -LiteralPath $Config -Raw
if ($toml.Contains("REPLACE_WITH_KV_NAMESPACE_ID")) {
    Write-Host "Creating Workers KV namespace ACTIVITY_KV..."
    $output = & npx wrangler kv namespace create ACTIVITY_KV --config $Config 2>&1
    if ($LASTEXITCODE -ne 0) {
        $output | Write-Host
        throw "Failed to create KV namespace."
    }

    $text = ($output | Out-String)
    $match = [regex]::Match($text, 'id\s*=\s*"([^"]+)"')
    if (!$match.Success) {
        $text | Write-Host
        throw "Could not parse KV namespace id from Wrangler output."
    }

    $namespaceId = $match.Groups[1].Value
    $updated = $toml.Replace("REPLACE_WITH_KV_NAMESPACE_ID", $namespaceId)
    Set-Content -LiteralPath $Config -Value $updated -Encoding UTF8
    Write-Host "Updated $Config with KV namespace id $namespaceId"
}
else {
    Write-Host "KV namespace id already configured."
}

Write-Host "Set Worker secret $TokenName when prompted."
Invoke-Wrangler -Arguments @("secret", "put", $TokenName, "--config", $Config)

Write-Host "Deploying Worker..."
Invoke-Wrangler -Arguments @("deploy", "--config", $Config)

Write-Host "Done."
