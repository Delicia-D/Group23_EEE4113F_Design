#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <esp_camera.h>
#include <Preferences.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// === CAMERA PIN CONFIG (AI Thinker ESP32-CAM) ===
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// === Wi-Fi Credentials ===
const char* ssid = "ESPTEST";
const char* password = "123456789";

// === Backend Endpoint ===
const char* serverURL = "https://penguin-monitoring-backend.onrender.com/upload";

Preferences preferences;

void initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    config.frame_size = FRAMESIZE_UXGA;
    config.jpeg_quality = 10;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x\n", err);
    ESP.restart();
  }

  // Adjust brightness, contrast, and gain
  sensor_t *s = esp_camera_sensor_get();
  s->set_gainceiling(s, (gainceiling_t)6);
  s->set_brightness(s, 1);
  s->set_contrast(s, 1);
}

void uploadData(String timestamp, String weight, camera_fb_t *fb) {
  if (!fb) {
    Serial.println("Invalid camera frame buffer. Skipping upload.");
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient https;
  if (https.begin(client, serverURL)) {
    String boundary = "----ESP32Boundary";
    String rfid = "KHUMO";

    String body;
    body += "--" + boundary + "\r\n";
    body += "Content-Disposition: form-data; name=\"rfid\"\r\n\r\n" + rfid + "\r\n";
    body += "--" + boundary + "\r\n";
    body += "Content-Disposition: form-data; name=\"weight\"\r\n\r\n" + weight + "\r\n";
    body += "--" + boundary + "\r\n";
    body += "Content-Disposition: form-data; name=\"timestamp\"\r\n\r\n" + timestamp + "\r\n";
    body += "--" + boundary + "\r\n";
    body += "Content-Disposition: form-data; name=\"image\"; filename=\"penguin.jpg\"\r\n";
    body += "Content-Type: image/jpeg\r\n\r\n";

    int jpegLen = fb->len;
    int totalLen = body.length() + jpegLen + 6 + boundary.length();
    String endRequest = "\r\n--" + boundary + "--\r\n";

    https.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
    https.addHeader("Content-Length", String(totalLen));

    String fullBody = body;
    fullBody.reserve(totalLen);
    fullBody += String((const char*)fb->buf, jpegLen);
    fullBody += endRequest;

    int responseCode = https.sendRequest("POST", fullBody);
    Serial.printf("HTTP Response: %d\n", responseCode);
    if (responseCode == 200) {
      Serial.println("Upload successful!");
      Serial.println(https.getString());
    } else {
      Serial.println("Upload failed!");
    }
    https.end();
  } else {
    Serial.println("HTTPS begin failed");
  }
}

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);  // Disable brownout detector
  Serial.begin(115200);

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
  Serial.println(WiFi.localIP());

  initCamera();

  // Example values
  String weight = "0.145";
  String timestamp = "2025-05-23T18:16";  // ISO 8601 format

  // Flash on GPIO 4
  pinMode(4, OUTPUT);
  digitalWrite(4, HIGH);
  delay(600);  // Increased delay for brighter exposure

  camera_fb_t *fb = esp_camera_fb_get();

  digitalWrite(4, LOW);  // Turn off the flash after capture

  if (!fb) {
    Serial.println("❌ Camera capture failed. Restarting...");
    delay(2000);
    ESP.restart();
  }

  uploadData(timestamp, weight, fb);
  esp_camera_fb_return(fb);
}

void loop() {
  // Nothing here, runs once
}