import boto3
from botocore.client import Config

ACCESS_KEY = "46955fec404ef8c28bffc1509139b05d"
SECRET_KEY = "0cf46d792d5bca87ebcf1fef7b8ad763506ca28505837ea4d8bd6c67e116c5e1"
ENDPOINT_URL = "https://81978408ef9cea0132b7bbf360bfc46b.r2.cloudflarestorage.com"
BUCKET_NAME = "penguin-images"

# S3 client for R2
s3 = boto3.client(
    "s3",
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    endpoint_url=ENDPOINT_URL,
    config=Config(signature_version="s3v4"),
    region_name="auto"
)

def upload_to_r2(file_obj, filename: str, content_type: str) -> str:
    s3.upload_fileobj(
        Fileobj=file_obj,
        Bucket=BUCKET_NAME,
        Key=filename,  
        ExtraArgs={"ContentType": content_type}
    )
    return filename  


def generate_presigned_url(key: str, expires_in=3600):
    return s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': BUCKET_NAME, 'Key': key},
        ExpiresIn=expires_in
    )
