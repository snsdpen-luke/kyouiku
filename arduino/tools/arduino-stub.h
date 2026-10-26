#include <stdlib.h>
#define HIGH 1
#define LOW 0
#define OUTPUT 1
#define INPUT 0
#define INPUT_PULLUP 2
#define A0 14
#define A1 15
#define min(a,b) ((a)<(b)?(a):(b))
#define constrain(x,a,b) ((x)<(a)?(a):((x)>(b)?(b):(x)))
void pinMode(int,int); void digitalWrite(int,int); void analogWrite(int,int); void delay(unsigned long);
int digitalRead(int); long pulseIn(int,int,unsigned long t=1000000UL); void delayMicroseconds(unsigned int);
unsigned long millis(); long random(long,long); void randomSeed(unsigned long); int analogRead(int);
long map(long,long,long,long,long);
void tone(int,unsigned int,unsigned long d=0); void noTone(int);
struct S_{ void begin(long); void print(const char*); void print(int); void print(long); void print(unsigned long);
  void println(const char*); void println(int); void println(long); void println(unsigned long);
  int available(); int read(); long parseInt(); } Serial;
struct Servo{ void attach(int); void write(int); };
