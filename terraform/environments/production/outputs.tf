output "ec2_public_ip" {
  value = module.compute.public_ip
}

output "cognito_user_pool_id" {
  value = module.auth.user_pool_id
}

output "cognito_client_id" {
  value = module.auth.client_id
}

output "cloudfront_distribution_id" {
  value = module.cdn.distribution_id
}

output "cloudfront_domain" {
  value = module.cdn.domain_name
}

output "frontend_bucket" {
  value = module.storage.frontend_bucket_name
}

output "media_bucket" {
  value = module.storage.media_bucket_name
}

output "nameservers" {
  value       = module.dns.nameservers
  description = "Update these NS records in Namecheap"
}
