terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# CloudFront requires ACM certs in us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

module "dns" {
  source      = "../../modules/dns"
  domain_name = var.domain_name
}

module "ssl" {
  source      = "../../modules/ssl"
  domain_name = var.domain_name
  zone_id     = module.dns.zone_id

  providers = {
    aws = aws.us_east_1
  }
}

module "network" {
  source           = "../../modules/network"
  project_name     = var.project_name
  environment      = var.environment
  allowed_ssh_cidr = var.allowed_ssh_cidr
}

module "storage" {
  source       = "../../modules/storage"
  project_name = var.project_name
  environment  = var.environment
  domain_name  = var.domain_name
}

module "email" {
  source      = "../../modules/email"
  domain_name = var.domain_name
  zone_id     = module.dns.zone_id
}

module "auth" {
  source       = "../../modules/auth"
  project_name = var.project_name
  domain_name  = var.domain_name
}

module "compute" {
  source               = "../../modules/compute"
  project_name         = var.project_name
  environment          = var.environment
  instance_type        = var.ec2_instance_type
  key_name             = var.ec2_key_name
  subnet_id            = module.network.public_subnet_id
  security_group_id    = module.network.app_security_group_id
  media_bucket_arn     = module.storage.media_bucket_arn
  ses_identity_arn     = module.email.ses_identity_arn
  db_password          = var.db_password
  cognito_user_pool_id = module.auth.user_pool_id
  cognito_client_id    = module.auth.client_id
  s3_media_bucket      = module.storage.media_bucket_name
  domain_name          = var.domain_name
  aws_region           = var.aws_region
}

module "cdn" {
  source                       = "../../modules/cdn"
  project_name                 = var.project_name
  domain_name                  = var.domain_name
  certificate_arn              = module.ssl.certificate_arn
  frontend_bucket_domain       = module.storage.frontend_bucket_domain
  api_origin_domain            = module.compute.public_dns
  zone_id                      = module.dns.zone_id
  media_bucket_regional_domain = module.storage.media_bucket_regional_domain
  media_bucket_arn             = module.storage.media_bucket_arn
  media_bucket_name            = module.storage.media_bucket_name
}
