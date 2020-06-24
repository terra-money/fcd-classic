-- typeorm doesn't support index on jsonb keys
-- block table index

create index if not exists block_header_index_gin
    on block using gin (((data -> 'block'::text) -> 'header'::text));

-- tx table index

create index if not exists tx_timestamp_index_gin
	on tx using gin ((data -> 'timestamp'::text));

create index if not exists tx_msg_index_gin
	on tx using gin ((((data -> 'tx'::text) -> 'value'::text) -> 'msg'::text));

create index if not exists tx_memo_index_gin
	on tx using gin ((((data -> 'tx'::text) -> 'value'::text) -> 'memo'::text));