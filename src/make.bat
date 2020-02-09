if not exist "..\build\bytecode\" mkdir "..\build\bytecode\"

cd "c code"

rem Build asm.js for old browsers
for %%i in (*) do start cmd.exe @cmd /k "emcc %%~nxi -O3 -s INVOKE_RUN=0 -s ENVIRONMENT='worker' -s WASM=0 -s MINIMAL_RUNTIME=1 -o ../../build/bytecode/%%~ni.asm.js && exit || echo error in %%~nxi"
rem Build WebAssembly for new browsers
for %%i in (*) do start cmd.exe @cmd /k "emcc %%~nxi -O3 -s WASM=1 -o ../../build/bytecode/%%~ni.wasm && exit || echo error in %%~nxi"
