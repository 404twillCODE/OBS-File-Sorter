# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['file.py'],
    pathex=[],
    binaries=[],
    datas=[('C:\\Users\\twj23\\Desktop\\Developer\\Programs\\OBS File Sorter\\obs_auto_sorter_config.json', '.')],
    hiddenimports=['keyboard'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='OBS_File_Sorter',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['C:\\Users\\twj23\\Desktop\\Developer\\Programs\\OBS File Sorter\\icon.ico'],
)
