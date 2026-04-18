# Surdej — Environments

> Where the application is running.

---

## Production

The frontend is deployed to **GitHub Pages** via GitHub Actions.

- **URL**: [https://happy-pdf-refinery.github.io/surdej-v1/](https://happy-pdf-refinery.github.io/surdej-v1/)
- **Workflow**: [.github/workflows/deploy-frontend.yml](../.github/workflows/deploy-frontend.yml)

## Local Development

- **Frontend**: [http://localhost:4001](http://localhost:4001)
- **API**: [http://localhost:5001](http://localhost:5001)
- **Helper**: [http://localhost:5050](http://localhost:5050)

## Derived Projects

Derived projects run on different ports to avoid conflicts (see [surdej.yaml](../surdej.yaml)).

| Project | Frontend | API | Helper | Repository |
|---------|----------|-----|--------|------------|
| `surdej-test-nexi` | [http://localhost:4002](http://localhost:4002) | [http://localhost:5002](http://localhost:5002) | [http://localhost:6002](http://localhost:6002) | [happy-mates/surdej-test-nexi](https://github.com/happy-mates/surdej-test-nexi) |
| `surdej-test-pdf-refinery` | [http://localhost:4003](http://localhost:4003) | [http://localhost:5003](http://localhost:5003) | [http://localhost:6003](http://localhost:6003) | [happy-mates/surdej-test-pdf-refinery](https://github.com/happy-mates/surdej-test-pdf-refinery) |
