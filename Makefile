.PHONY: e2e e2e-install

e2e-install:
	cd e2e && npm install && npx playwright install

e2e:
	cd e2e && npm run test
