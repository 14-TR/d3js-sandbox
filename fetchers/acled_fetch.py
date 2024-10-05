# fetchers/acled_fetch.py
import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def fetch_acled_data():
    api_key = os.getenv('ACLED_API_KEY')
    email = os.getenv('ACLED-EMAIL') 
    if not api_key:
        raise ValueError("API key not found. Please set the ACLED_API_KEY in the .env file.")

    base_url = "https://api.acleddata.com/acled/read"
    params = {
        'key': api_key,
        'email': email,
        'country': 'Ukraine',
        'event_date': '2023-01-01|2024-01-01',
        'limit': 1000
    }

    all_data = []
    offset = 0

    while True:
        params['offset'] = offset
        response = requests.get(base_url, params=params)
        response.raise_for_status()

        data = response.json()
        events = data.get('data', [])

        if not events:
            break

        all_data.extend(events)
        offset += len(events)

    # Save to a JSON file in the data directory
    os.makedirs('data', exist_ok=True)
    with open('data/acled_data.json', 'w') as f:
        json.dump(all_data, f)

    print("ACLED data has been saved to data/acled_data.json")

if __name__ == '__main__':
    fetch_acled_data()
