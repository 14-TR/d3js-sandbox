import os
import requests
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def fetch_acled_data():
    api_key = os.getenv('ACLED_API_KEY')
    email = os.getenv('ACLED_EMAIL')
    if not api_key or not email:
        raise ValueError("API key or email not found. Please set the ACLED_API_KEY and ACLED_EMAIL in the .env file.")

    base_url = "https://api.acleddata.com/acled/read"

    # Generate all dates from Jan 1, 2022, to today
    start_date = datetime(2022, 1, 1)
    end_date = datetime.now()
    date_ranges = [(start_date + timedelta(days=i)).strftime('%Y-%m-%d') for i in range((end_date - start_date).days + 1)]

    all_data = []
    max_iterations = 1  # Set a limit to avoid infinite loops

    try:
        for date in date_ranges:
            date_range = f"{date}|{date}"
            offset = 0
            iteration_count = 0  # To track the number of iterations for each date
            print(f"Fetching data for date: {date_range}")

            while True:
                params = {
                    'key': api_key,
                    'email': email,
                    'country': 'Ukraine',
                    'event_date': date_range,
                    'limit': 1000,
                    'offset': offset
                }

                response = requests.get(base_url, params=params)
                response.raise_for_status()

                data = response.json()
                events = data.get('data', [])

                if not events:
                    print(f"No more events found for date: {date_range}")
                    break

                all_data.extend(events)
                offset += len(events)
                iteration_count += 1

                print(f"Fetched {len(events)} events for date {date}. Total so far: {len(all_data)}")

                # Safety check to avoid infinite loop
                if iteration_count >= max_iterations:
                    print(f"Reached maximum iteration limit for date: {date}. Exiting loop to avoid infinite loop.")
                    break

        if not all_data:
            print("No data fetched from ACLED.")
            return

        # Save to a JSON file in the data directory
        os.makedirs('data', exist_ok=True)
        with open('data/acled_data.json', 'w') as f:
            json.dump(all_data, f)

        print(f"ACLED data has been saved to data/acled_data.json. Total events: {len(all_data)}")

    except Exception as e:
        print(f"An error occurred: {e}")
        print(f"Response text: {response.text}")  # Log the response text for debugging

if __name__ == '__main__':
    fetch_acled_data()
