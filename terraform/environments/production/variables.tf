variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "thirlwall"
}

variable "domain_name" {
  type    = string
  default = "thirlwall.ca"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "ec2_instance_type" {
  type    = string
  default = "t4g.micro"
}

variable "ec2_key_name" {
  type        = string
  description = "SSH key pair name for EC2 access"
  default     = ""
}

variable "allowed_ssh_cidr" {
  type        = string
  description = "CIDR block allowed to SSH into EC2"
  default     = "0.0.0.0/0"
}

variable "db_password" {
  type        = string
  description = "PostgreSQL password for production"
  sensitive   = true
}
