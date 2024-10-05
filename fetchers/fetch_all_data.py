# fetchers/fetch_all_data.py
from acled_fetch import fetch_acled_data
from viirs_fetch import fetch_viirs_data

if __name__ == '__main__':
    fetch_acled_data()
    fetch_viirs_data()
    print("All data sources have been fetched and saved.")
