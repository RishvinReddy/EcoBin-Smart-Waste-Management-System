# EcoBin — Municipal Corporation of Hyderabad
## Driver Portal & Route Collection Guide

Welcome to the EcoBin Driver Portal. This guide details the login credentials for all municipal waste collection trucks in Hyderabad and explains how to operate the driver dashboard to execute optimized routes.

---

## 1. Fleet Login Credentials

There are currently **5 active collection trucks** assigned to the Hyderabad Municipal waste management network. Use the corresponding **Truck ID** to log in to the portal.

| Truck ID | Assigned Driver | Plate Number | Vehicle Capacity | License Number | Phone Number |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`TRK-HYD-01`** | Ramesh Kumar | TS09EA0001 | 5,000 L | TS123456 | +91 98765 43210 |
| **`TRK-HYD-02`** | Suresh Reddy | TS09EA0002 | 5,000 L | TS123457 | +91 98765 43211 |
| **`TRK-HYD-03`** | Vijay Babu | TS09EA0003 | 5,000 L | TS123458 | +91 98765 43212 |
| **`TRK-HYD-04`** | Naresh Yadav | TS09EA0004 | 5,000 L | TS123459 | +91 98765 43213 |
| **`TRK-HYD-05`** | Prasad Goud | TS09EA0005 | 4,000 L | TS123460 | +91 98765 43214 |

---

## 2. Using the Driver Dashboard

### Step 1: Accessing the Portal & Logging In
1. Open the EcoBin Driver Portal URL: `http://localhost:5173/driver`.
2. You will be greeted by the clean, light-themed **Driver Access Portal** login screen.
3. Enter your assigned **Truck ID** (e.g., `TRK-HYD-03`) into the input field.
4. Click **Access Route Dashboard**.

### Step 2: Route Overview & Statistics
Once logged in, the dashboard loads your active optimized route:
- **Header**: Displays your name, assigned truck, and current date.
- **Stops Progress**: A progress bar showing the percentage of bins collected on this shift.
- **Key Statistics**: 
  - **Route Distance**: Total road distance in kilometers.
  - **Estimated Time**: Estimated duration of the shift.
  - **Next Stop**: Name and details of your immediate collection target.

### Step 3: Interactive Map Navigation
- An interactive, light-themed Leaflet map displays your complete snapped road route.
- **Markers**: 
  - **Depot**: Starting and ending point of the collection trip.
  - **Numbered Pins**: Order of bin stops along the optimized path.
  - **Colors**: Bins are color-coded by priority (Green = Low, Yellow = Medium, Red = Critical/Full).

### Step 4: Step-by-Step Collection
The sidebar displays your ordered list of assigned bin stops:
1. Drive to the **Next Stop** indicated at the top of the sidebar.
2. Once you arrive at the bin location, empty the physical bin into the truck.
3. On the dashboard, click **Empty Bin** for that stop.
4. The system will send a telemetry request to reset the bin's fill level to `0.0%` in the database.
5. The stop will update to a green **Collected** badge. This status persists even if you refresh the browser page.
6. The next bin in the sequence will automatically become your active target.

### Step 5: Reporting Maintenance / Blockages
If you arrive at a bin and cannot empty it due to physical damage or access blockages:
1. Click the **Report Issue** icon (red warning triangle) next to the bin in the stops list.
2. In the modal dialog:
   - Select the **Issue Type** (e.g., *Damaged Lid*, *Blocked Access*, *Sensor Failure*, *Vandalism*).
   - Enter additional details in the **Notes** field.
3. Click **Submit Alert**.
4. The bin is automatically put into **Maintenance** status and marked for dispatch to repair crews, skipping it from your active route.

### Step 6: Completing the Shift
1. After collecting all assigned bins, drive back to the **Depot** (final stop).
2. Click **Empty Bin** on the depot to finish the route.
3. When your shift is complete, click **Logout** in the top header to secure the session.
