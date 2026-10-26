// サンプラー用スケッチ（Arduino UNO R3）
// ボタンを押すと、その番号（1〜4）をPCに送る。
// 配線：ボタンの片方の足をピンへ、もう片方をGNDへ。抵抗はいらない。

const int PINS[] = {2, 3, 4, 5};   // ボタン1〜4をつなぐピン
const int N = 4;
const unsigned long WAIT_MS = 20;  // チャタリング（押した瞬間のガタつき）よけ

int lastState[N];
unsigned long lastChange[N];

void setup() {
  Serial.begin(9600);
  for (int i = 0; i < N; i++) {
    pinMode(PINS[i], INPUT_PULLUP);  // 押していないときHIGH、押すとLOW
    lastState[i] = HIGH;
    lastChange[i] = 0;
  }
}

void loop() {
  for (int i = 0; i < N; i++) {
    int now = digitalRead(PINS[i]);
    if (now != lastState[i] && millis() - lastChange[i] > WAIT_MS) {
      lastChange[i] = millis();
      lastState[i] = now;
      if (now == LOW) {
        Serial.println(i + 1);  // 押された番号を送る
      }
    }
  }
}
