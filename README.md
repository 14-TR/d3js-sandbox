# Geospatial Data Visualizations

## Setup

1. Clone the repository.
2. Create a `.env` file in the root directory and add your API keys:
    ```
    ACLED_API_KEY=your_acled_api_key_here
    VIIRS_API_KEY=your_viirs_api_key_here
    ```

3. Install dependencies:
    ```bash
    pip install requests python-dotenv
    ```

4. Run the fetch scripts to get the data:
    ```bash
    python fetchers/fetch_all_data.py
    ```

5. Open `index.html` in a browser to view the visualizations.
