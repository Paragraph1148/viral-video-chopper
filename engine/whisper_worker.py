import whisper
import sys
import json
import os

def transcribe(file_path):
    if not os.path.exists(file_path):
        print(json.dumps({"error": "File not found"}))
        return

    try:
        # 'base' model is a great balance of speed and accuracy for EC2
        # Use 'tiny' if you want even more speed, 'small' for better accuracy
        model = whisper.load_model("base")
        result = model.transcribe(file_path)

        # Format the output for Node.js to consume easily
        output = {
            "text": result["text"],
            "segments": [
                {"start": segment["start"], "end": segment["end"], "text": segment["text"]}
                for segment in result["segments"]
            ]
        }
        print(json.dumps(output))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
    else:
        transcribe(sys.argv[1])