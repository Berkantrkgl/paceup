# custom_storages.py
from storages.backends.s3boto3 import S3Boto3Storage

class MediaStorage(S3Boto3Storage):
    location = 'media' # S3 bucket içinde 'media' klasörüne kaydeder
    file_overwrite = False # Aynı isimli dosya yüklenirse eskisini silmez, ismini değiştirir