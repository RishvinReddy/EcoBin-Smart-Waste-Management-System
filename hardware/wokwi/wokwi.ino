#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>
#include <WiFi.h>
#include <HTTPClient.h>

// ---------------- Pin Definitions ----------------
#define TRIG_PIN 5
#define ECHO_PIN 18

#define SERVO_PIN 13
#define PIR_PIN 27
#define BUTTON_PIN 12

#define RED_LED 25
#define GREEN_LED 26
#define BLUE_LED 33

#define BUZZER 14

// ---------------- LCD ----------------
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ---------------- Servo ----------------
Servo lidServo;

// ----------- Bin Dimensions (cm) -----------
const float BIN_HEIGHT = 30.0;

// Servo Positions
const int OPEN_ANGLE = 90;
const int CLOSE_ANGLE = 0;

// ---------------- WiFi & API ----------------
const char* ssid = "Wokwi-GUEST";
const char* password = "";
const char* serverUrl = "http://10.0.2.2:8000/api/bin/update"; // Host gateway IP in Wokwi
const String BIN_ID = "BIN001"; // Represents the first bin in Hyderabad database

unsigned long lastTelemetryTime = 0;
const unsigned long telemetryInterval = 10000; // Send telemetry every 10 seconds
float lastSentFill = -1.0;

// ------------------------------------------------

void connectWiFi() {
  Serial.print("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 10) {
    delay(1000);
    Serial.print(".");
    lcd.setCursor(attempts, 1);
    lcd.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected to WiFi!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected!");
  } else {
    Serial.println("\nWiFi connection failed! Offline mode activated.");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Offline Mode");
  }
  delay(1500);
}

void sendTelemetry(float fillLevel) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    // Construct JSON payload manually
    String payload = "{\"bin_id\":\"" + BIN_ID + 
                     "\",\"fill_percentage\":" + String(fillLevel, 2) + 
                     ",\"battery\":95.0" + 
                     ",\"temperature\":27.8}";

    Serial.print("Sending telemetry: ");
    Serial.println(payload);

    int httpResponseCode = http.POST(payload);
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.print("HTTP Response code: ");
      Serial.println(httpResponseCode);
      Serial.println(response);
    } else {
      Serial.print("Error sending POST: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  } else {
    Serial.println("WiFi not connected. Telemetry transmission skipped.");
  }
}

// ------------------------------------------------

void setup() {

  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  pinMode(PIR_PIN, INPUT);

  pinMode(BUTTON_PIN, INPUT_PULLUP);

  pinMode(RED_LED, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(BLUE_LED, OUTPUT);

  pinMode(BUZZER, OUTPUT);

  lidServo.setPeriodHertz(50);
  lidServo.attach(SERVO_PIN);

  lidServo.write(CLOSE_ANGLE);

  lcd.init();
  lcd.backlight();

  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print(" SMART BIN ");
  lcd.setCursor(0,1);
  lcd.print(" Initializing");

  delay(2000);

  lcd.clear();
  
  // Connect to WiFi
  connectWiFi();
  lcd.clear();
}

void loop() {

  // Manual Button
  if(digitalRead(BUTTON_PIN)==LOW){
    openLid();
  }

  // PIR Detection
  if(digitalRead(PIR_PIN)==HIGH){
    openLid();
  }

  float distance = measureDistance();

  float fill = ((BIN_HEIGHT-distance)/BIN_HEIGHT)*100;

  if(fill<0) fill=0;
  if(fill>100) fill=100;

  Serial.print("Fill Level: ");
  Serial.print(fill);
  Serial.println("%");

  lcd.clear();

  lcd.setCursor(0,0);
  lcd.print("Fill:");
  lcd.print((int)fill);
  lcd.print("%");

  if(fill<50){

      lcd.setCursor(0,1);
      lcd.print("Status: EMPTY");

      digitalWrite(GREEN_LED,HIGH);
      digitalWrite(RED_LED,LOW);
      digitalWrite(BLUE_LED,LOW);

      noTone(BUZZER);

  }
  else if(fill<80){

      lcd.setCursor(0,1);
      lcd.print("Status:MEDIUM");

      digitalWrite(GREEN_LED,HIGH);
      digitalWrite(RED_LED,HIGH);
      digitalWrite(BLUE_LED,LOW);

      noTone(BUZZER);

  }
  else{

      lcd.setCursor(0,1);
      lcd.print("BIN FULL!");

      digitalWrite(GREEN_LED,LOW);
      digitalWrite(RED_LED,HIGH);
      digitalWrite(BLUE_LED,LOW);

      tone(BUZZER,1000);
      delay(300);
      noTone(BUZZER);
  }

  // Telemetry check
  if (millis() - lastTelemetryTime >= telemetryInterval || abs(fill - lastSentFill) >= 2.0) {
    sendTelemetry(fill);
    lastTelemetryTime = millis();
    lastSentFill = fill;
  }

  delay(1000);
}

// ------------------------------------------------

float measureDistance(){

  digitalWrite(TRIG_PIN,LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN,HIGH);
  delayMicroseconds(10);

  digitalWrite(TRIG_PIN,LOW);

  long duration=pulseIn(ECHO_PIN,HIGH);

  float distance=duration*0.0343/2;

  return distance;
}

// ------------------------------------------------

void openLid(){

  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print("Opening Lid");

  lidServo.write(OPEN_ANGLE);

  delay(5000);

  lidServo.write(CLOSE_ANGLE);

  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print("Lid Closed");
  delay(1000);
}