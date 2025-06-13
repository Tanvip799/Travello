# 🟣 Multi-Modal Route Planning App

## 📹 Demo

https://github.com/user-attachments/assets/cc0912e1-6215-4c23-a1b0-23c0797b87c1



## 🟣 Features

### 🔹 **Natural Language Voice Input**
Users can input complex, multi-stop travel plans through voice. Speech is transcribed using **OpenAI Whisper**, allowing for flexible, conversational inputs.  
**Example:**  
_"I want to go from Sardar Patel Institute of Technology to TSG Sports Arena in Borivali, and then towards Greeshma Residency in Thane. On the way to TSG, I want to stop at a library. While heading home from TSG, I want to stop for petrol."_

### 🔹 **NLP-Powered Intent Extraction**
The transcribed text is processed using **Gemini** to extract:
- The ordered sequence of main destinations.
- Intermediate preferences, such as specific stopovers.
- Categorization of each location as **Primary destination** or **Auxiliary Point of Interest (POI)** (e.g., petrol pump, library).

The output is structured into a clean **JSON format** for further processing.

### 🔹 **Multimodal Route Generation (Car and Public Transit)**
- If the user selects **car**, routes are computed using **Ola Maps Directions API**.
- If the user prefers **public transit**, routes are generated using **OpenTripPlanner**, backed by manually compiled GTFS data (supports metro, bus, and train schedules).
- The system can **dynamically reprocess the route** if preferences change.

### 🔹 **Dynamic Point of Interest (POI) Integration and Rerouting**
- For each auxiliary stop (e.g., petrol, library), nearby suggestions are fetched using **Ola Maps Places API**.
- The user can select from these suggestions.
- The route is then automatically recalculated based on the selected POIs and overall path logic.

### 🔹 **In-App Public Transit Ticket Booking**
- If the final journey involves public transport, users can directly book their ticket **within the app**.
- The booking process utilizes **Google Pay deep linking**, allowing a smooth transition from route planning to booking.

---

## 🟣 Run Instruction

Follow these instructions to run the application locally:

1️⃣ **Start Native App (Client)**
```bash
cd native/
npm install
npm start
```
2️⃣ **Start Flask API (Server)**
```bash
cd server/
pip install -r requirements.txt
flask run
```
