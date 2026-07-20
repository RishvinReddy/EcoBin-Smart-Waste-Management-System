# 04 Hardware

## 1. IoT Simulation Framework (Wokwi)

Since deploying physical sensors across a city for initial testing is cost-prohibitive, the EcoBin project heavily relies on the **Wokwi** simulator. Wokwi allows us to compile and run standard Arduino C++ code on a simulated ESP32 microcontroller directly in the browser or via VS Code.

## 2. Sensor Loadout

The simulated node (`diagram.json`) consists of the following components:

1. **ESP32 DevKit V4:** The central compute module handling logic, sensor reading, and HTTP communication.
2. **HC-SR04 Ultrasonic Sensor:** Measures the distance from the top of the bin to the waste surface, converting distance to a fill percentage.
3. **PIR Motion Sensor:** Acts as a tamper detection or human-proximity trigger.
4. **Servo Motor:** Simulates the automatic opening and closing of the bin lid.
5. **I2C LCD1602:** Displays the local bin ID and current fill status to nearby sanitation workers.
6. **RGB LED & Buzzer:** Visual and audio indicators for critical states (e.g., bin full, tamper detected).
7. **Push Button:** Simulates a manual collection override or maintenance reset.

## 3. Firmware Architecture

The ESP32 firmware reads the HC-SR04 at predefined intervals. It maps the distance to a volume percentage (0-100%). When the percentage crosses the threshold (e.g., 80%), or on a scheduled heartbeat, it constructs a JSON payload containing:
- `bin_id`
- `fill_percentage`
- `battery_level`
- `temperature`

This payload is pushed to the backend via a `POST` request to `http://<backend_ip>/api/iot/push`.
