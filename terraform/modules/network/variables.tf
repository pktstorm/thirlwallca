variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "allowed_ssh_cidr" {
  type    = string
  default = "0.0.0.0/0"
}
