"""
Test script for evaluating confidence scores with different temperature settings.
"""

import requests
import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from tabulate import tabulate
import json

# Constants
API_URL = "http://localhost:5000/predict"
TEST_FILE = r"C:\Users\ZAM\Desktop\New folder\4k\verifiable_input (1).csv"

def test_confidence_with_file(file_path):
    """Test the API with a file and return the response"""
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}")
        return None
    
    print(f"\nTesting API with file: {os.path.basename(file_path)}")
    
    # Send request
    try:
        with open(file_path, 'rb') as f:
            files = {'file': (os.path.basename(file_path), f, 'text/csv')}
            response = requests.post(API_URL, files=files)
        
        # Print response
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Predicted label: {result.get('predicted_label')}")
            print(f"Confidence: {result.get('confidence')}%")
            
            # Print details if available
            if 'details' in result:
                print("\nAdditional Details:")
                for key, value in result['details'].items():
                    if key == 'classes':
                        print(f"  {key}: [{', '.join(value)}]")
                    else:
                        print(f"  {key}: {value}")
            
            return result
        else:
            print(f"Error response: {response.text}")
            return None
    except Exception as e:
        print(f"Error: {str(e)}")
        return None

def compare_multiple_samples(file_path, num_samples=5):
    """Compare predictions for multiple samples from the file"""
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}")
        return
    
    # Read the CSV file
    df = pd.read_csv(file_path, header=None)
    
    # If we have fewer rows than requested, adjust
    num_samples = min(num_samples, df.shape[0])
    
    results = []
    
    # Process each sample individually
    for i in range(num_samples):
        # Extract a single sample
        sample = df.iloc[i:i+1, :]
        
        # Save to a temporary file
        temp_file = f"temp_sample_{i}.csv"
        sample.to_csv(temp_file, index=False, header=False)
        
        print(f"\nTesting sample {i+1}:")
        
        # Send request
        try:
            with open(temp_file, 'rb') as f:
                files = {'file': (temp_file, f, 'text/csv')}
                response = requests.post(API_URL, files=files)
            
            if response.status_code == 200:
                result = response.json()
                print(f"Predicted label: {result.get('predicted_label')}")
                print(f"Confidence: {result.get('confidence')}%")
                
                if 'details' in result and 'raw_confidence' in result['details']:
                    print(f"Raw confidence: {result['details']['raw_confidence']}%")
                
                results.append(result)
            else:
                print(f"Error response: {response.text}")
        except Exception as e:
            print(f"Error: {str(e)}")
        
        # Clean up temporary file
        if os.path.exists(temp_file):
            os.remove(temp_file)
    
    # Display summary
    if results:
        print("\nSummary of Results:")
        table_data = []
        for i, result in enumerate(results):
            raw_conf = result.get('details', {}).get('raw_confidence', 'N/A')
            table_data.append([
                i+1,
                result.get('predicted_label', 'N/A'),
                result.get('confidence', 'N/A'),
                raw_conf
            ])
        
        headers = ["Sample", "Predicted Label", "Confidence (%)", "Raw Confidence (%)"]
        print(tabulate(table_data, headers=headers, tablefmt="grid"))
        
        # Calculate average confidence
        confidences = [result.get('confidence', 0) for result in results]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        
        raw_confidences = [result.get('details', {}).get('raw_confidence', 0) for result in results]
        avg_raw_confidence = sum(raw_confidences) / len(raw_confidences) if raw_confidences else 0
        
        print(f"\nAverage confidence: {avg_confidence:.2f}%")
        print(f"Average raw confidence: {avg_raw_confidence:.2f}%")
        
        # Plot confidence comparison
        plot_confidence_comparison(results)
        
        return results
    
    return None

def plot_confidence_comparison(results):
    """Plot a comparison of raw vs boosted confidence scores"""
    if not results:
        return
    
    labels = [f"Sample {i+1}" for i in range(len(results))]
    raw_confidences = [result.get('details', {}).get('raw_confidence', 0) for result in results]
    boosted_confidences = [result.get('confidence', 0) for result in results]
    
    x = np.arange(len(labels))
    width = 0.35
    
    fig, ax = plt.subplots(figsize=(10, 6))
    rects1 = ax.bar(x - width/2, raw_confidences, width, label='Raw Confidence')
    rects2 = ax.bar(x + width/2, boosted_confidences, width, label='Boosted Confidence')
    
    ax.set_ylabel('Confidence (%)')
    ax.set_title('Raw vs Boosted Confidence Scores')
    ax.set_xticks(x)
    ax.set_xticklabels(labels)
    ax.legend()
    ax.set_ylim(0, 105)  # Set y-axis limit to 105% to show full bars
    
    # Add prediction labels above bars
    for i, result in enumerate(results):
        label = result.get('predicted_label', '')
        ax.annotate(label,
                    xy=(i, max(boosted_confidences[i], raw_confidences[i]) + 5),
                    ha='center', va='bottom',
                    rotation=45 if len(label) > 5 else 0)
    
    plt.tight_layout()
    plt.savefig('confidence_comparison.png')
    print("\nConfidence comparison plot saved as 'confidence_comparison.png'")

def test_json_endpoint(file_path):
    """Test the JSON endpoint with data from a file"""
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}")
        return None
    
    print(f"\nTesting JSON endpoint with data from: {os.path.basename(file_path)}")
    
    # Read the CSV file
    df = pd.read_csv(file_path, header=None)
    
    # Convert to list for JSON
    data = df.iloc[:, :1024].values.tolist()
    
    # Send request
    try:
        response = requests.post(
            "http://localhost:5000/predict/json",
            json={"data": data},
            headers={"Content-Type": "application/json"}
        )
        
        # Print response
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Predicted label: {result.get('predicted_label')}")
            print(f"Confidence: {result.get('confidence')}%")
            
            # Print details if available
            if 'details' in result:
                print("\nAdditional Details:")
                print(json.dumps(result['details'], indent=2))
            
            return result
        else:
            print(f"Error response: {response.text}")
            return None
    except Exception as e:
        print(f"Error: {str(e)}")
        return None

if __name__ == "__main__":
    # Test with the provided file
    result = test_confidence_with_file(TEST_FILE)
    
    # Compare multiple samples
    print("\n" + "="*50)
    print("Testing multiple samples individually:")
    results = compare_multiple_samples(TEST_FILE)
    
    # Test JSON endpoint
    print("\n" + "="*50)
    print("Testing JSON endpoint:")
    json_result = test_json_endpoint(TEST_FILE)
    
    # Check API info
    print("\n" + "="*50)
    print("Checking API information:")
    try:
        response = requests.get("http://localhost:5000/info")
        print(f"Status code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"Error checking API info: {str(e)}") 