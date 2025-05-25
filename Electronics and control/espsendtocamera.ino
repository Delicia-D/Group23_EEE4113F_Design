#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <RTClib.h>
#include <HX711.h>
#include <WiFi.h>
#include <esp_now.h>

// --- Constants ---
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define I2C_ADDRESS   0x3C
#define TRIG_PIN      27
#define ECHO_PIN      34
#define DT1  33
#define SCK1 32
#define DT2  25
#define SCK2 26
#define DIST_THRESHOLD_CM 30

// --- Devices ---
RTC_DS3231 rtc;
HX711 scale1;
HX711 scale2;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// --- Data structure to send ---
typedef struct {
  char rfid[16];
  char weight[8];
  char timestamp[25];
} UploadPayload;

UploadPayload dataToSend;

// --- ESP32-CAM MAC Address ---
uint8_t esp32camAddress[] = { 0xEC, 0xE3, 0x34, 0xD7, 0x84, 0xB8 };

void onSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  Serial.print("ESP-NOW Send Status: ");
  Serial.println(status == ESP_NOW_SEND_SUCCESS ? "Success" : "Fail");
}

// --- Helpers ---
String getTimestamp() {
  DateTime now = rtc.now();
  char buffer[25];
  sprintf(buffer, "%04d-%02d-%02dT%02d:%02d", now.year(), now.month(), now.day(),
          now.hour(), now.minute());
  return String(buffer);
}

long getDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  return duration * 0.0343 / 2;
}

void setup() {
  Serial.begin(115200);
  Wire.begin();

  // OLED
  display.begin(SSD1306_SWITCHCAPVCC, I2C_ADDRESS);
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // RTC
  if (!rtc.begin()) {
    Serial.println("RTC not found.");
    while (1);
  }
  if (rtc.lostPower()) {
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }

  // Ultrasonic
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  // Load Cells
  delay(4000);
  scale1.begin(DT1, SCK1); delay(4000);
  scale2.begin(DT2, SCK2); delay(4000);
  scale1.set_scale(573700.0);
  scale2.set_scale(566000.0);
  scale1.tare();
  scale2.tare();

  // WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin("ESPTEST", "123456789");  // If needed for channel sync
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  uint8_t channel = WiFi.channel();
  Serial.print("📡 Sender WiFi channel: ");
  Serial.println(channel);

  WiFi.disconnect(); // Go offline for ESP-NOW

  // ESP-NOW
  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW init failed");
    while (1);
  }
  esp_now_register_send_cb(onSent);

  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, esp32camAddress, 6);
  peerInfo.channel = channel;  //Use same channel
  peerInfo.encrypt = false;

  if (!esp_now_is_peer_exist(esp32camAddress)) {
    if (esp_now_add_peer(&peerInfo) != ESP_OK) {
      Serial.println("Failed to add ESP32-CAM peer");
      while (1);
    }
  }

  Serial.println("ESP-NOW ready");
}

void loop() {
  long distance = getDistance();
  float weight1 = scale1.get_units(5);
  float weight2 = scale2.get_units(5);
  float averageWeight = weight1 + weight2;
  String timestampStr = getTimestamp();

  // Display info
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Time:");
  display.println(timestampStr);
  display.print("Dist: ");
  display.print(distance);
  display.println(" cm");
  display.print("Weight: ");
  display.print(averageWeight, 3);
  display.println(" kg");
  display.display();

  if (distance < DIST_THRESHOLD_CM) {
    // Fill payload
    strncpy(dataToSend.rfid, "D9 3E 3B 02", sizeof(dataToSend.rfid));
    dtostrf(averageWeight, 4, 2, dataToSend.weight);
    strncpy(dataToSend.timestamp, timestampStr.c_str(), sizeof(dataToSend.timestamp));

    esp_err_t result = esp_now_send(esp32camAddress, (uint8_t *)&dataToSend, sizeof(dataToSend));
    if (result == ESP_OK) {
      Serial.println("Sent to ESP32-CAM:");
      Serial.print("RFID: "); Serial.println(dataToSend.rfid);
      Serial.print("Weight: "); Serial.println(dataToSend.weight);
      Serial.print("Timestamp: "); Serial.println(dataToSend.timestamp);
    } else {
      Serial.print("ESP-NOW Send Failed: ");
      Serial.println(result);
    }

    delay(3000);
  }

  delay(1000);
}
