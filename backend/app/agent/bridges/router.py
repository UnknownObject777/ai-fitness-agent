def route_modality(has_image: bool, has_video: bool, user_message: str) -> str:
    text = user_message.lower()
    if has_video:
        return "video_analysis"
    if has_image and any(word in text for word in ["餐", "饭", "food", "meal", "午餐", "早餐", "晚餐"]):
        return "nutrition_image"
    if has_image:
        return "image_general"
    return "text"
