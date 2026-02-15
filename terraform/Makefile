.PHONY: help init plan apply destroy outputs validate format

AWS_PROFILE :=
ENV := production

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

init: ## Initialize Terraform
	cd environments/$(ENV) && AWS_PROFILE=$(AWS_PROFILE) terraform init

plan: ## Plan infrastructure changes
	cd environments/$(ENV) && AWS_PROFILE=$(AWS_PROFILE) terraform plan -var-file=$(ENV).tfvars

apply: ## Apply infrastructure changes
	cd environments/$(ENV) && AWS_PROFILE=$(AWS_PROFILE) terraform apply -var-file=$(ENV).tfvars

destroy: ## Destroy all infrastructure (interactive)
	@echo "WARNING: This will destroy ALL infrastructure for thirlwall.ca!"
	@read -p "Continue? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	cd environments/$(ENV) && AWS_PROFILE=$(AWS_PROFILE) terraform destroy

outputs: ## Show current outputs
	cd environments/$(ENV) && AWS_PROFILE=$(AWS_PROFILE) terraform output

validate: ## Validate config
	cd environments/$(ENV) && terraform init -backend=false && terraform validate

format: ## Format Terraform files
	terraform fmt -recursive .
