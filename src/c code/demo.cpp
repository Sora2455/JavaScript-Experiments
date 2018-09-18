#include <stdio.h>
#include <emscripten.h>

EMSCRIPTEN_KEEPALIVE
extern "C" double my_add(double num1, double num2) {
    return num1 + num2;
}