this is the code, just remove the part where it is trying to connect to server : // ESP32-CAM Code: Receives data via ESP-NOW and saves to SD only
#include <WiFi.h>
#include <esp_now.h>
#include "esp_camera.h"
#include "FS.h"
#include "SD_MMC.h"

// --- Camera Pin Definitions (AI Thinker) ---
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

struct UploadPayload {
  char rfid[16];
  char weight[8];
  char timestamp[25];
};
UploadPayload receivedData;

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
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("Camera init failed!");
    ESP.restart();
  }
}

void saveToSD(camera_fb_t* fb) {
  if (!fb) {
    Serial.println("Frame buffer is null!");
    return;
  }

  if (SD_MMC.begin()) {
    String cleanTime = String(receivedData.timestamp);
    cleanTime.replace(":", "-");
    cleanTime.replace("T", "_");

    String path = "/" + String(receivedData.rfid) + "_" + cleanTime + ".jpg";

    File file = SD_MMC.open(path, FILE_WRITE);
    if (file) {
      file.write(fb->buf, fb->len);
      file.close();
      Serial.println("Saved to SD: " + path);
    } else {
      Serial.println("Failed to save to SD");
    }

    File logFile = SD_MMC.open("/penguin_log.csv", FILE_APPEND);
    if (logFile) {
      logFile.printf("%s,%s,%s\n", receivedData.rfid, receivedData.weight, receivedData.timestamp);
      logFile.close();
      Serial.println("Logged to CSV");
    } else {
      Serial.println("Failed to log CSV");
    }
    SD_MMC.end();
  } else {
    Serial.println("SD card init failed");
  }
}

void onReceiveData(const esp_now_recv_info_t *info, const uint8_t *incomingData, int len) {
  if (len != sizeof(UploadPayload)) {
    Serial.println("Received unexpected data size");
    return;
  }

  memcpy(&receivedData, incomingData, sizeof(receivedData));
  receivedData.rfid[15] = '\0';
  receivedData.weight[7] = '\0';
  receivedData.timestamp[24] = '\0';

  Serial.println("Data received via ESP-NOW:");
  Serial.println(receivedData.rfid);
  Serial.println(receivedData.weight);
  Serial.println(receivedData.timestamp);

  //pinMode(4, OUTPUT);
  //digitalWrite(4, HIGH);
  //delay(500);
  //digitalWrite(4, LOW);

  camera_fb_t *fb = esp_camera_fb_get();
  if (fb) {
    saveToSD(fb);
    esp_camera_fb_return(fb);
  } else {
    Serial.println("Camera capture failed");
  }
}

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  initCamera();

  if (esp_now_init() == ESP_OK) {
    esp_now_register_recv_cb(onReceiveData);
    Serial.println("ESP-NOW receiver ready");
  } else {
    Serial.println("ESP-NOW init failed");
  }
}

void loop() {
  delay(10000);  // Idle loop
}
