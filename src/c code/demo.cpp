#include <stdio.h>
#include <emscripten.h>

int main(int argc, char ** argv) {
}

EMSCRIPTEN_KEEPALIVE
extern "C" double my_add(double num1, double num2) {
    return num1 + num2;
}