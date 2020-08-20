if not exist "..\build\bytecode\" mkdir "..\build\bytecode\"

cd "rust code"

rem Build asm.js for old browsers
for %%i in (*) do rustc %%~nxi --target asmjs-unknown-emscripten -C opt-level=0 -C link-arg="-s ENVIRONMENT=worker" -C link-arg="-s MINIMAL_RUNTIME=1" -C link-arg="-s LEGACY_VM_SUPPORT=1" -o ../../build/bytecode/%%~ni.asm.js
rem Build WebAssembly for new browsers
for %%i in (*) do rustc %%~nxi --target wasm32-unknown-emscripten -C opt-level=3 -o ../../build/bytecode/%%~ni.wasm
