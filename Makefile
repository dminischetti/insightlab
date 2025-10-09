.PHONY: all derive validate sql figures site clean

PY=python

all: derive validate sql figures

derive:
	$(PY) tools/derive.py

validate:
	$(PY) tools/validate.py

sql:
	mkdir -p data/duckdb_outputs
	python tools/run_sql.py

figures:
	$(PY) tools/figures.py

site: all
	# stage the static site for Pages under ./site
	rm -rf site && mkdir -p site
	rsync -a --exclude 'site' --exclude '.git' --exclude '.github' ./ site/
	# ensure generated artifacts are included
	mkdir -p site/appendix/figures site/data data
	cp -f data/derived_summary.json site/data/derived_summary.json
	cp -f data/viz_payload.json site/data/viz_payload.json
	cp -rf appendix site/appendix

clean:
	rm -rf site data/duckdb_outputs
	rm -f appendix/figures/*.png
