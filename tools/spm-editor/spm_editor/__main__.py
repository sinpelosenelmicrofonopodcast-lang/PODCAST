import argparse
import json
from pathlib import Path
from .core import validate, compile_plan, save_json
from .resolve import inspect_manifest

def main():
    parser=argparse.ArgumentParser(prog='spm-editor')
    parser.add_argument('command',choices=['validate','dry-run','inspect','run','resume','status','qc'])
    parser.add_argument('manifest',nargs='?')
    parser.add_argument('--output',default='SPM_REPORTS')
    parser.add_argument('--render',help='Actual exported media to measure during qc')
    args=parser.parse_args()
    report=Path(args.output)/'status.json'
    if args.command=='status':
        print(report.read_text() if report.is_file() else '{"status":"NOT_STARTED"}')
        return 0
    if not args.manifest:
        parser.error('manifest is required')
    try:
        manifest=validate(json.loads(Path(args.manifest).read_text()))
        result=compile_plan(manifest)
        if args.command == 'inspect':
            result['resolve']=inspect_manifest(manifest)
        if args.command in ['run','resume']:
            from .engine import Engine
            result=Engine(manifest,args.output).run()
            save_json(report,result)
            print(json.dumps(result,ensure_ascii=False,indent=2))
            return 0 if result.get('ready_for_review') else 2
        if args.command=='qc':
            result['qc_scope']='CONTRACT_AND_TIME_MAP_ONLY'
            result['project_qc']='NOT_EXECUTED'
            if args.render:
                from .finishing import measure_render
                result['rendered_audio']=measure_render(args.render,manifest['audio'].get('target_lufs',-16),
                                                       manifest['audio'].get('true_peak_db',-1))
                save_json(report,result)
                print(json.dumps(result,ensure_ascii=False,indent=2))
                return 0 if result['rendered_audio']['passed'] else 2
        save_json(report,result)
        print(json.dumps(result,ensure_ascii=False,indent=2))
        return 0
    except Exception as exc:
        execution=Path(args.output)/'execution.json'
        result=json.loads(execution.read_text()) if execution.is_file() else {'project_modified':False}
        result.update({'integration_status':'BLOCKED','error':str(exc)})
        save_json(report,result)
        print(json.dumps(result,ensure_ascii=False))
        return 2

if __name__=='__main__':
    raise SystemExit(main())
