# Hardware Requirements

## 1. Hardware Stack

```mermaid
mindmap
  root((Hardware Setup))
    Microcontroller
      ESP32 DevKit V4
    Sensors
      HC-SR04 Ultrasonic
      PIR Motion
    Outputs
      I2C LCD1602
      RGB LED
      Piezo Buzzer
    Simulation
      Wokwi Framework
```

## 2. Detailed Specifications

| Component | Function | Required Spec | Voltage |
| :--- | :--- | :--- | :--- |
| **ESP32** | Core processing and HTTP POST via WiFi. | Xtensa Dual-Core 32-bit | 3.3V |
| **HC-SR04** | Measures distance to waste surface. | 2cm - 400cm range | 5V |
| **PIR** | Detects tampering or human proximity. | <1s response | 3.3V / 5V |
| **LCD1602** | Local diagnostics display. | I2C backpack | 5V |
| **Piezo Buzzer** | Audio alerts for critical errors. | Passive buzzer | 3.3V |
