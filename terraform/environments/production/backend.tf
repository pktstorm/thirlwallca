terraform {
  backend "s3" {
    bucket         = "thirlwall-tf-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "thirlwall-tf-lock"
  }
}
