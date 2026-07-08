interface FrontmatterBlockProps {
	content: string;
}

interface FrontmatterField {
	key: string;
	values: string[];
}

function cleanScalar(value: string) {
	const trimmed = value.trim();
	if (trimmed.length < 2) {
		return trimmed;
	}

	const quote = trimmed[0];
	return (quote === '"' || quote === "'") && trimmed[trimmed.length - 1] === quote
		? trimmed.slice(1, -1)
		: trimmed;
}

function parseFrontmatter(content: string): FrontmatterField[] {
	const lines = content
		.replace(/\r\n?/g, '\n')
		.split('\n')
		.map((line) => line.trimEnd())
		.filter((line) => line.trim() !== '---' && line.trim().length > 0);
	const fields: FrontmatterField[] = [];
	let current: FrontmatterField | null = null;

	for (const line of lines) {
		const listMatch = line.match(/^\s*-\s+(.+)$/);
		if (listMatch && current) {
			current.values.push(cleanScalar(listMatch[1]));
			continue;
		}

		const fieldMatch = line.match(/^([^:#]+):\s*(.*)$/);
		if (!fieldMatch) {
			continue;
		}

		current = {
			key: fieldMatch[1].trim(),
			values: fieldMatch[2].trim() ? [cleanScalar(fieldMatch[2])] : [],
		};
		fields.push(current);
	}

	return fields;
}

export function FrontmatterBlock({ content }: FrontmatterBlockProps) {
	const fields = parseFrontmatter(content);

	if (fields.length === 0) {
		return null;
	}

	return (
		<section className="frontmatter-block" aria-label="YAML frontmatter">
			<div className="frontmatter-title">Metadata</div>
			<dl className="frontmatter-grid">
				{fields.map((field) => (
					<div className="frontmatter-row" key={field.key}>
						<dt>{field.key}</dt>
						<dd>
							{field.values.length > 1 ? (
								<div className="frontmatter-chips">
									{field.values.map((value) => (
										<span className="frontmatter-chip" key={value}>
											{value}
										</span>
									))}
								</div>
							) : (
								<span>{field.values[0] ?? ''}</span>
							)}
						</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
