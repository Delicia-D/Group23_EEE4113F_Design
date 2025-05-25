#include "HX711.h"

// Load Cell 1
#define DT1  33
#define SCK1 32

// Load Cell 2
#define DT2  25
#define SCK2 26

HX711 scale1;
HX711 scale2;

// Butterworth coefficients (2nd order low-pass)
float b[] = {0.0675, 0.1349, 0.0675};
float a[] = {-1.14298, 0.4128};

// Filter state variables
float x[3] = {0.0}, y[3] = {0.0};

void setup() {
  Serial.begin(115200);
  delay(4000);

  scale1.begin(DT1, SCK1);
  scale2.begin(DT2, SCK2);

  scale1.set_scale(566000.0);
  scale2.set_scale(566000.0);
  scale1.tare();
  scale2.tare();

  Serial.println("Scales ready. Applying Butterworth filter.");
}

void loop() {
  // Shift input and output history
  x[2] = x[1]; x[1] = x[0];
  y[2] = y[1]; y[1] = y[0];

  // Read new weight sample
  float w1 = scale1.get_units(5);
  float w2 = scale2.get_units(5);
  x[0] = w1 + w2;

  // Apply filter difference equation
  y[0] = b[0]*x[0] + b[1]*x[1] + b[2]*x[2]
         - a[0]*y[1] - a[1]*y[2];

  Serial.print("Raw: ");
  Serial.print(x[0], 3);
  Serial.print("  Filtered: ");
  Serial.println(y[0], 3);

  delay(200);
}