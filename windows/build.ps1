param([string]$OutputDirectory=(Join-Path $PSScriptRoot 'out\portable'))
$ErrorActionPreference='Stop'
$output=[IO.Path]::GetFullPath($OutputDirectory)
$cache=Join-Path $PSScriptRoot 'out\downloads'
New-Item -ItemType Directory -Force -Path $output,$cache | Out-Null

function Get-VerifiedDownload([string]$Url,[string]$Path,[string]$SHA256) {
    if(!(Test-Path -LiteralPath $Path)){Invoke-WebRequest -Uri $Url -OutFile $Path}
    if((Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash -ne $SHA256){throw "Checksum mismatch: $Path"}
}

dotnet publish (Join-Path $PSScriptRoot 'app\OBSFileSorter.csproj') -c Release --self-contained false -o $output --nologo
if($LASTEXITCODE -ne 0){throw 'Windows application build failed'}
New-Item -ItemType Directory -Force -Path (Join-Path $output 'engine'),(Join-Path $output 'runtime') | Out-Null
foreach($name in @('backend.py','legacy_engine.py','original_methods.marshal','original-methods.json')){
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "engine\$name") -Destination (Join-Path $output 'engine') -Force
}

$pythonZip=Join-Path $cache 'python-3.13.17-embed-amd64.zip'
Get-VerifiedDownload 'https://www.python.org/ftp/python/3.13.17/python-3.13.17-embed-amd64.zip' $pythonZip '9E35319BFFEDAB8B36AD44D8F377CB4F1733BCEC257A0B6D04D94F01486DDB38'
Expand-Archive -LiteralPath $pythonZip -DestinationPath (Join-Path $output 'runtime') -Force
# Embedded Python uses explicit import paths; no system Python or pip is needed.
[IO.File]::WriteAllText((Join-Path $output 'runtime\python313._pth'),"python313.zip`n.`n../engine`n../engine/Lib`n")

$keyboardZip=Join-Path $cache 'keyboard-0.13.5.zip'
Get-VerifiedDownload 'https://files.pythonhosted.org/packages/55/88/287159903c5b3fc6d47b651c7ab65a54dcf9c9916de546188a7f62870d6d/keyboard-0.13.5-py3-none-any.whl' $keyboardZip '8e9c2422f1217e0bd84489b9ecd361027cc78415828f4fe4f88dd4acd587947b'
Expand-Archive -LiteralPath $keyboardZip -DestinationPath (Join-Path $output 'engine\Lib') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'README.md') -Destination (Join-Path $output 'README.md') -Force

$env:OBS_SORTER_ROOT=$output
try {
    & (Join-Path $output 'runtime\python.exe') (Join-Path $PSScriptRoot 'tests\test_sorter.py')
    if($LASTEXITCODE -ne 0){throw 'Processing engine tests failed'}
} finally {Remove-Item Env:\OBS_SORTER_ROOT -ErrorAction SilentlyContinue}
$archive=Join-Path (Split-Path $output -Parent) 'OBS-File-Sorter-Windows.zip'
Compress-Archive -Path (Join-Path $output '*') -DestinationPath $archive -Force
Write-Output "Build and tests passed: $archive"
