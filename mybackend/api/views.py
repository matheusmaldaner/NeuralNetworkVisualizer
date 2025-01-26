from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import torch
from PIL import Image
import io
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from datetime import datetime

from .difflogic_setup import (
    load_difflogic_model,
    store_user_model,
    choose_model_path,
    process_image_with_model,
    get_model_info
)

class ModelAPIView(APIView):
    """
    1) If POST includes a .pth under 'model_file', store as user_model.
       Return JSON of the loaded model's layers/edges.
    2) Else, read 'model_choice' from request.data to pick one of the builtin models
       or 'user_model'. Return that model's layers/edges in JSON.
    """
    def post(self, request, *args, **kwargs):
        uploaded_file = request.FILES.get('model_file')
        if uploaded_file:
            # Store as user_model.pth, overwriting any existing one
            try:
                path_user_model = store_user_model(uploaded_file)
                model = load_difflogic_model(path_user_model)
                info = get_model_info(model)
                return Response({
                    "message": "User model uploaded and loaded successfully.",
                    "model_choice": "user_model",
                    "model_info": info
                }, status=status.HTTP_200_OK)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # No file => must specify which model to load
        model_choice = request.data.get('model_choice')
        if not model_choice:
            return Response({
                "error": "No 'model_file' uploaded and no 'model_choice' provided."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Attempt to load chosen model
        try:
            path = choose_model_path(model_choice)
            model = load_difflogic_model(path)
            info = get_model_info(model)
            return Response({
                "message": f"Model '{model_choice}' loaded successfully.",
                "model_choice": model_choice,
                "model_info": info
            }, status=status.HTTP_200_OK)
        except FileNotFoundError as fe:
            return Response({"error": str(fe)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class ImageAPIView(APIView):
    def post(self, request, *args, **kwargs):
        image_file = request.FILES.get('image_file')
        if not image_file:
            return Response({"error": "No 'image_file' provided."},
                            status=status.HTTP_400_BAD_REQUEST)

        model_choice = request.data.get('model_choice')
        if not model_choice:
            return Response({
                "error": "No 'model_choice' specified. Must be one of model_001, model_002, model_003, or user_model."
            }, status=status.HTTP_400_BAD_REQUEST)

        # 1. Load the requested model (CPU)
        path = choose_model_path(model_choice)
        model = load_difflogic_model(path)

        # 2. Convert the uploaded image to a flat tensor
        try:
            # Create a unique filename for the uploaded image
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"uploaded_images/{timestamp}_{image_file.name}"
            
            # Read the file content and reset the file pointer
            file_content = image_file.read()
            image_file.seek(0)  # Reset the file pointer to the beginning

            # Save the file to the server's media directory
            file_path = default_storage.save(filename, ContentFile(file_content))
            
            # Generate the URL for the saved image
            image_url = request.build_absolute_uri(default_storage.url(file_path))

            # Verify the saved file by attempting to open it
            with default_storage.open(file_path, 'rb') as saved_file:
                pil_img = Image.open(saved_file).convert('L')
                width, height = pil_img.size
                image_tensor = torch.tensor(list(pil_img.getdata()), dtype=torch.float32)

            print('Image saved and verified successfully')
        except Exception as e:
            return Response({"error": f"Failed to save or verify image: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 3. (Optional) Resize/check shape. For a 20x20 model:
        # if width * height != 400:
        #     return Response({
        #         "error": f"Expected 20x20=400 pixels, got {width}x{height}."
        #     }, status=status.HTTP_400_BAD_REQUEST)

        # 4. Forward pass to get model outputs (and gate distributions)
        with torch.no_grad():
            outputs = model(image_tensor.unsqueeze(0))

        # 5. Determine predicted class
        _, predicted_class = torch.max(outputs, dim=1)
        predicted_class = predicted_class.item()

        # 7. Retrieve model structure info
        info = get_model_info(model)

        # 8. Return everything in the response
        return Response({
            "predicted_class": predicted_class,
            "model_info": info,
            "image_url": image_url
        }, status=status.HTTP_200_OK)
