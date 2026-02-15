variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "instance_type" {
  type    = string
  default = "t4g.micro"
}

variable "key_name" {
  type    = string
  default = ""
}

variable "subnet_id" {
  type = string
}

variable "security_group_id" {
  type = string
}

variable "media_bucket_arn" {
  type = string
}

variable "ses_identity_arn" {
  type = string
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "cognito_user_pool_id" {
  type    = string
  default = ""
}

variable "cognito_client_id" {
  type    = string
  default = ""
}

variable "s3_media_bucket" {
  type    = string
  default = ""
}

variable "domain_name" {
  type    = string
  default = ""
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}
