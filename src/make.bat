call C:\Users\boree\Downloads\emsdk\emsdk_env.bat

if not exist "..\build\bytecode\" mkdir "..\build\bytecode\"

cd "c code"

rem Build asm.js for old browsers
for %%i in (*) do start cmd.exe @cmd /k "emcc %%~nxi -O3 -s INVOKE_RUN=0 -s WASM=0 -s NO_DYNAMIC_EXECUTION=1 -s MODULARIZE=1 -s EXPORT_NAME='%%~niasmjs' -o ../../build/bytecode/%%~ni.asm.js && exit || echo error in %%~nxi"
rem Build WebAssembly for new browsers
for %%i in (*) do start cmd.exe @cmd /k "emcc %%~nxi -O0 -s INVOKE_RUN=0 -s WASM=1 -s MODULARIZE=1 -s EXPORT_NAME='%%~niwasmjs' -o ../../build/bytecode/%%~ni.wasm.js && exit || echo error in %%~nxi"
