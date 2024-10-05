# fetchers/viirs_fetch.py
import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def fetch_viirs_data():
    base_url = "YOUR_VIIRS_DATA_SOURCE_URL"
    params = {
        # Add any relevant parameters here
    }

    response = requests.get(base_url, params=params)
    response.raise_for_status()

    viirs_data = response.json()

    # Save to a JSON file in the data directory
    os.makedirs('data', exist_ok=True)
    with open('data/viirs_data.json', 'w') as f:
        json.dump(viirs_data, f)

    print("VIIRS data has been saved to data/viirs_data.json")

if __name__ == '__main__':
    fetch_viirs_data()
