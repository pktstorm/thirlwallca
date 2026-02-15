output "instance_id" {
  value = aws_instance.app.id
}

output "public_ip" {
  value = aws_eip.app.public_ip
}

output "public_dns" {
  # Construct DNS from EIP since CloudFront requires a hostname, not an IP
  value = "ec2-${replace(aws_eip.app.public_ip, ".", "-")}.compute-1.amazonaws.com"
}
